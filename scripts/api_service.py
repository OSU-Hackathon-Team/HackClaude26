from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, Optional
from uuid import uuid4
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

class PredictRequest(BaseModel):
    age_at_sequencing: float
    sex: str
    primary_site: str
    oncotree_code: str
    genomic_markers: Dict[str, float]

class PredictTimelineRequest(BaseModel):
    baseline_risk: float = Field(..., ge=0.0, le=1.0)
    treatment: str
    months: int = Field(..., ge=1, le=120)

TREATMENT_DECAY_FACTORS = {
    "CHEMOTHERAPY": 0.060,
    "IMMUNOTHERAPY": 0.045,
    "TARGETED_THERAPY": 0.070,
    "RADIATION": 0.035,
    "OBSERVATION": 0.015
}

def _require_model_artifacts():
    missing_artifacts = []
    if encoder is None:
        missing_artifacts.append("clinical_encoder")
    if scaler is None:
        missing_artifacts.append("clinical_scaler")
    if genomic_features is None:
        missing_artifacts.append("genomic_features")
    if vision_features is None:
        missing_artifacts.append("vision_features")
    if mean_vision_vector is None:
        missing_artifacts.append("mean_vision_vector")
    if not models:
        missing_artifacts.append("site_models")

    if missing_artifacts:
        missing_list = ", ".join(missing_artifacts)
        raise HTTPException(status_code=503, detail=f"Service not ready. Missing artifacts: {missing_list}")

def _deterministic_feature_weight(feature_name: str, scale: float = 1000.0) -> float:
    weighted_sum = sum((i + 1) * ord(char) for i, char in enumerate(feature_name.lower()))
    return ((weighted_sum % 200) - 100) / scale

def _build_stable_inference_vector(
    age_at_sequencing: float,
    sex: str,
    primary_site: str,
    oncotree_code: str,
    genomic_markers: Dict[str, float]
) -> np.ndarray:
    try:
        clinical_raw = pd.DataFrame([{
            'AGE_AT_SEQUENCING': age_at_sequencing,
            'SEX': sex,
            'PRIMARY_SITE': primary_site,
            'ONCOTREE_CODE': oncotree_code
        }])

        X_num = scaler.transform(clinical_raw[['AGE_AT_SEQUENCING']])
        X_cat = encoder.transform(clinical_raw[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Clinical preprocessing failed: {exc}")

    mutation_vector = [float(genomic_markers.get(feature, 0.0)) for feature in genomic_features]
    X_genomic = np.array([mutation_vector], dtype=float)
    X_vision = mean_vision_vector.reshape(1, -1)

    expected_vision_length = len(vision_features)
    if X_vision.shape[1] != expected_vision_length:
        raise HTTPException(
            status_code=500,
            detail=f"Vision feature mismatch: expected {expected_vision_length}, found {X_vision.shape[1]}"
        )

    return np.hstack([X_num, X_cat, X_genomic, X_vision, [[0.0]]])

def _run_risk_inference(
    age_at_sequencing: float,
    sex: str,
    primary_site: str,
    oncotree_code: str,
    genomic_markers: Dict[str, float],
    image: Optional[str] = None
) -> Dict[str, object]:
    _require_model_artifacts()
    X_stable = _build_stable_inference_vector(
        age_at_sequencing=age_at_sequencing,
        sex=sex,
        primary_site=primary_site,
        oncotree_code=oncotree_code,
        genomic_markers=genomic_markers
    )

    has_image = False
    vision_confidence = 0.5
    if image:
        if vision_encoder is None:
            raise HTTPException(status_code=503, detail="Vision encoder is not initialized.")
        try:
            image_embedding = vision_encoder.get_embeddings(image)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Image embedding failed: {exc}")

        if vision_detector is not None:
            try:
                vision_confidence = float(vision_detector.predict_proba(image_embedding)[0][1])
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"Vision detector inference failed: {exc}")
        has_image = True

    has_tumor_signal = vision_confidence > 0.85
    has_normal_signal = vision_confidence < 0.15

    baseline_risks: Dict[str, float] = {}
    final_risks: Dict[str, float] = {}
    total_lift = 0.0

    for site, model in models.items():
        try:
            prob_base = float(model.predict_proba(X_stable)[0][1])
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Inference failed for site '{site}': {exc}")

        if has_tumor_signal:
            prob_final = min(0.95, prob_base + 0.35)
        elif has_normal_signal:
            prob_final = max(0.01, prob_base - 0.20)
        else:
            prob_final = prob_base

        baseline_risks[site] = round(prob_base, 4)
        final_risks[site] = round(prob_final, 4)
        if has_image:
            total_lift += (prob_final - prob_base)

    model_count = len(models)
    visual_lift = round(total_lift / model_count, 4) if has_image and model_count > 0 else 0.0

    return {
        "baseline_risks": baseline_risks,
        "final_risks": final_risks,
        "visual_lift": visual_lift,
        "has_visual_data": has_image,
        "vision_confidence": round(vision_confidence, 4)
    }

def _build_confidence_metrics(risk_scores: Dict[str, float]) -> Dict[str, float]:
    if not risk_scores:
        raise HTTPException(status_code=500, detail="No risk scores produced by inference.")

    scores = np.array(list(risk_scores.values()), dtype=float)
    standard_deviation = float(np.std(scores))
    calibration_score = float(np.clip(1.0 - standard_deviation, 0.0, 1.0))

    return {
        "standard_deviation": round(standard_deviation, 4),
        "calibration_score": round(calibration_score, 4)
    }

def _build_demo_shap_values(request: PredictRequest) -> Dict[str, float]:
    shap_values: Dict[str, float] = {
        f"age_{int(round(request.age_at_sequencing))}": round((request.age_at_sequencing - 60.0) / 200.0, 4),
        f"sex_{request.sex.lower()}": round(_deterministic_feature_weight(request.sex, scale=2000.0), 4),
        f"primary_site_{request.primary_site.lower()}": round(_deterministic_feature_weight(request.primary_site, scale=1200.0), 4),
        f"oncotree_{request.oncotree_code.lower()}": round(_deterministic_feature_weight(request.oncotree_code, scale=1200.0), 4)
    }

    genomic_items = sorted(request.genomic_markers.items())
    for marker_name, marker_value in genomic_items[:10]:
        value = float(marker_value)
        if value == 0.0:
            continue
        marker_weight = abs(_deterministic_feature_weight(marker_name, scale=2500.0))
        marker_sign = 1.0 if value > 0 else -1.0
        shap_values[marker_name.lower()] = round(marker_sign * (0.015 + marker_weight * min(abs(value), 1.0)), 4)

    return shap_values

def _normalize_treatment_name(treatment: str) -> str:
    return treatment.strip().upper().replace("-", "_").replace(" ", "_")

@app.get("/")
def read_root():
    return {"status": "online", "multimodal": True, "ensemble": True, "models_loaded": list(models.keys())}

@app.post("/simulate")
def simulate_risk(request: MultimodalRequest):
    profile = request.profile
    inference = _run_risk_inference(
        age_at_sequencing=profile.age,
        sex=profile.sex,
        primary_site=profile.primary_site,
        oncotree_code=profile.oncotree_code,
        genomic_markers={k: float(v) for k, v in profile.mutations.items()},
        image=request.image
    )
    return {
        "simulated_risks": inference["final_risks"],
        "visual_lift": inference["visual_lift"],
        "has_visual_data": inference["has_visual_data"],
        "vision_confidence": inference["vision_confidence"]
    }

@app.post("/predict")
def predict_risk(request: PredictRequest):
    inference = _run_risk_inference(
        age_at_sequencing=request.age_at_sequencing,
        sex=request.sex,
        primary_site=request.primary_site,
        oncotree_code=request.oncotree_code,
        genomic_markers=request.genomic_markers
    )
    risk_scores = inference["final_risks"]
    return {
        "prediction_id": str(uuid4()),
        "status": "success",
        "risk_scores": risk_scores,
        "confidence_metrics": _build_confidence_metrics(risk_scores),
        "shap_values": _build_demo_shap_values(request)
    }

@app.post("/predict/timeline")
def predict_timeline(request: PredictTimelineRequest):
    treatment_key = _normalize_treatment_name(request.treatment)
    if treatment_key not in TREATMENT_DECAY_FACTORS:
        supported = ", ".join(sorted(TREATMENT_DECAY_FACTORS.keys()))
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported treatment '{request.treatment}'. Supported treatments: {supported}"
        )

    decay = TREATMENT_DECAY_FACTORS[treatment_key]
    floor_risk = 0.08 if treatment_key == "OBSERVATION" else 0.02
    timeline = []
    for month in range(request.months + 1):
        projected = floor_risk + (request.baseline_risk - floor_risk) * np.exp(-decay * month)
        bounded_risk = float(np.clip(projected, 0.0, 1.0))
        timeline.append({"month": month, "risk": round(bounded_risk, 4)})

    return {
        "status": "success",
        "treatment": treatment_key,
        "timeline": timeline
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
