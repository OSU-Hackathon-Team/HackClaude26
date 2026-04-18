from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, Optional
from scripts.extract_embeddings import VisionEncoder

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OncoPath Multimodal API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'
REAL_DATA_PATH = 'data/camelyon16_features_v2.csv'

# Globals
encoder = None
scaler = None
genomic_features = None
vision_features = None
models = {}
vision_encoder = None
mean_vision_vector = None
vision_detector = None # Level 2 Ensemble Signal

@app.on_event("startup")
def startup_event():
    global encoder, scaler, genomic_features, vision_features, models, vision_encoder, mean_vision_vector, vision_detector
    import traceback
    try:
        print("Initializing AI Service Artifacts...")
        encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
        scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
        genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
        vision_features = joblib.load(os.path.join(MODEL_DIR, 'vision_features.joblib'))
        
        # 1. Initialize Vision Model (The Eyes)
        vision_encoder = VisionEncoder()
        
        # 2. Load Vision Detector (The Level 2 Ensemble Signal)
        detector_path = os.path.join(MODEL_DIR, 'vision_detector.joblib')
        if os.path.exists(detector_path):
            vision_detector = joblib.load(detector_path)
            print("Vision Detector online (Decision Engine Layer 2).")
        
        # 3. Load Mean Vector for Imputation
        if os.path.exists(REAL_DATA_PATH):
            df_real = pd.read_csv(REAL_DATA_PATH)
            numeric_vision = [c for c in vision_features if c in df_real.columns]
            mean_vision_vector = df_real[numeric_vision].mean().values
            print("Loaded reference library for imputation.")
        else:
            mean_vision_vector = np.zeros(len(vision_features))
            print("Warning: No reference library found. Using zero-imputation.")

        # 4. Discovery available models
        model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_' ) and f.endswith('.joblib')]
        models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
        
        print(f"API Startup Complete: {len(models)} sites operational.")
    except Exception as e:
        print(f"Startup Failure Traceback:")
        traceback.print_exc()

class PatientProfile(BaseModel):
    age: float
    sex: str
    primary_site: str
    oncotree_code: str
    mutations: Dict[str, int]

class MultimodalRequest(BaseModel):
    profile: PatientProfile
    image: Optional[str] = None # Base64 encoded slide

class TemporalSimulationRequest(BaseModel):
    profile: PatientProfile
    image: Optional[str] = None
    months: int = 24
    mode: str = "untreated"  # untreated | treatment_adjusted
    treatment: Optional[str] = None

TEMPORAL_MODES = {"untreated", "treatment_adjusted"}
TREATMENT_COEFFICIENTS = {
    "CHEMOTHERAPY": {"decay_rate": 0.14, "floor_factor": 0.45, "resistance_rate": 0.04},
    "IMMUNOTHERAPY": {"decay_rate": 0.10, "floor_factor": 0.55, "resistance_rate": 0.03},
    "ORAL_DRUG": {"decay_rate": 0.08, "floor_factor": 0.65, "resistance_rate": 0.05},
}

@app.get("/")
def read_root():
    return {"status": "online", "multimodal": True, "ensemble": True, "models_loaded": list(models.keys())}

def ensure_artifacts_ready():
    if scaler is None or encoder is None or genomic_features is None or mean_vision_vector is None:
        raise HTTPException(status_code=503, detail="Model artifacts are not initialized")
    if len(models) == 0:
        raise HTTPException(status_code=503, detail="No site-specific models are loaded")

def run_multimodal_inference(request: MultimodalRequest):
    ensure_artifacts_ready()
    profile = request.profile

    clinical_raw = pd.DataFrame([{
        'AGE_AT_SEQUENCING': profile.age,
        'SEX': profile.sex,
        'PRIMARY_SITE': profile.primary_site,
        'ONCOTREE_CODE': profile.oncotree_code
    }])

    X_num = scaler.transform(clinical_raw[['AGE_AT_SEQUENCING']])
    X_cat = encoder.transform(clinical_raw[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])

    mut_vector = [profile.mutations.get(feat, 0) for feat in genomic_features]
    X_genomic = np.array([mut_vector])

    # Stage 1 baseline: keep the model input stable with imputed vision features.
    X_stable = np.hstack([X_num, X_cat, X_genomic, mean_vision_vector.reshape(1, -1), [[0]]])

    has_image = False
    vision_confidence = 0.5
    if request.image:
        v_vec = vision_encoder.get_embeddings(request.image)
        if vision_detector:
            vision_confidence = float(vision_detector.predict_proba(v_vec)[0][1])
        has_image = True

    risks = {}
    total_lift = 0.0
    has_tumor_signal = vision_confidence > 0.85
    has_normal_signal = vision_confidence < 0.15
    for site, model in models.items():
        prob_base = float(model.predict_proba(X_stable)[0][1])
        if has_tumor_signal:
            prob_final = min(0.95, prob_base + 0.35)
        elif has_normal_signal:
            prob_final = max(0.01, prob_base - 0.20)
        else:
            prob_final = prob_base

        risks[site] = round(prob_final, 4)
        if has_image:
            total_lift += (prob_final - prob_base)

    return {
        "simulated_risks": risks,
        "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
        "has_visual_data": has_image,
        "vision_confidence": round(vision_confidence, 4),
    }

def project_temporal_risk(base_risk: float, month: int, mode: str, treatment: Optional[str]):
    if month == 0:
        return round(base_risk, 6)

    if mode == "untreated":
        growth_rate = 0.04 + (base_risk * 0.24)
        carrying_capacity = min(0.995, base_risk + (1.0 - base_risk) * (0.55 + 0.25 * base_risk))
        risk = carrying_capacity - (carrying_capacity - base_risk) * np.exp(-growth_rate * month)
    else:
        coeff = TREATMENT_COEFFICIENTS[treatment]
        floor = max(0.002, base_risk * coeff["floor_factor"])
        decay_curve = floor + (base_risk - floor) * np.exp(-coeff["decay_rate"] * month)
        resistance = coeff["resistance_rate"] * (1 - np.exp(-0.12 * max(0, month - 6)))
        risk = decay_curve + resistance * (1 - decay_curve)

    return round(float(np.clip(risk, 0.0, 0.999)), 6)

@app.post("/simulate")
def simulate_risk(request: MultimodalRequest):
    try:
        return run_multimodal_inference(request)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate/temporal")
def simulate_temporal_risk(request: TemporalSimulationRequest):
    mode = request.mode.lower()
    if mode not in TEMPORAL_MODES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid mode '{request.mode}'. Supported modes: untreated, treatment_adjusted"
        )

    if request.months < 1 or request.months > 60:
        raise HTTPException(status_code=422, detail="months must be between 1 and 60")

    treatment = None
    if mode == "treatment_adjusted":
        if not request.treatment:
            raise HTTPException(
                status_code=422,
                detail="treatment is required when mode is treatment_adjusted"
            )
        treatment = request.treatment.upper()
        if treatment not in TREATMENT_COEFFICIENTS:
            allowed = ", ".join(TREATMENT_COEFFICIENTS.keys())
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported treatment '{request.treatment}'. Supported: {allowed}"
            )

    try:
        base_result = run_multimodal_inference(
            MultimodalRequest(profile=request.profile, image=request.image)
        )

        baseline_risks = base_result["simulated_risks"]
        timeline = []
        for month in range(request.months + 1):
            month_risks = {}
            for site, base_risk in baseline_risks.items():
                month_risks[site] = project_temporal_risk(float(base_risk), month, mode, treatment)

            values = list(month_risks.values())
            timeline.append({
                "month": month,
                "risks": month_risks,
                "max_risk": round(float(np.max(values)), 6) if values else 0.0,
                "mean_risk": round(float(np.mean(values)), 6) if values else 0.0
            })

        return {
            "mode": mode,
            "treatment": treatment,
            "months": request.months,
            "baseline_risks": baseline_risks,
            "timeline": timeline,
            "visual_lift": base_result["visual_lift"],
            "has_visual_data": base_result["has_visual_data"]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Temporal Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
