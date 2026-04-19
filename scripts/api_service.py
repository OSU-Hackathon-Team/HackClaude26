from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, Optional, List
from uuid import uuid4
from scripts.extract_embeddings import VisionEncoder
from scripts.copilot_timeline_service import CopilotTimelineService, TimelineExplainRequest

from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv() # Load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

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
MODEL_DIR = 'models'
REAL_DATA_PATH = 'data/camelyon16_features_v2.csv'

# Globals
encoder = None
scaler = None
genomic_features = None
models = {}
vision_encoder = None
vision_detector = None
supabase: Optional[Client] = None
timeline_service = CopilotTimelineService()

@app.on_event("startup")
def startup_event():
    global encoder, scaler, genomic_features, models, vision_encoder, vision_detector, supabase
    import traceback
    try:
        # Initialize Supabase
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            supabase = create_client(url, key)
            print("Supabase connection established.")
        
        print("Initializing AI Service Artifacts...")
        encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
        scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
        genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
        
        vision_encoder = VisionEncoder()
        detector_path = os.path.join(MODEL_DIR, 'vision_detector.joblib')
        if os.path.exists(detector_path):
            vision_detector = joblib.load(detector_path)
            print("Vision Detector online.")

        model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_' ) and f.endswith('.joblib')]
        models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
        
        print(f"API Startup Complete: {len(models)} sites operational.")
    except Exception as e:
        print(f"Startup Failure Traceback:")
        traceback.print_exc()

class PatientProfile(BaseModel):
    name: str 
    age: float
    sex: str
    primary_site: str
    oncotree_code: str
    mutations: Dict[str, int]

class MultimodalRequest(BaseModel):
    profile: PatientProfile
    image: Optional[str] = None
    doctor_id: Optional[str] = None

class PredictTimelineRequest(BaseModel):
    profile: PatientProfile
    risks: Dict[str, float] = Field(default_factory=dict)
    baseline_risk: float = Field(0.0, ge=0.0, le=1.0)
    treatment: str
    months: int = Field(..., ge=1, le=120)
    organ: Optional[str] = None

class TemporalSimulationRequest(BaseModel):
    profile: PatientProfile
    image: Optional[str] = None
    months: int = 24
    mode: str = "untreated"  # untreated | treatment_adjusted
    treatment: Optional[str] = None

TREATMENT_COEFFICIENTS = {
    "CHEMOTHERAPY": {"decay_rate": 0.14, "floor_factor": 0.45, "resistance_rate": 0.04},
    "IMMUNOTHERAPY": {"decay_rate": 0.10, "floor_factor": 0.55, "resistance_rate": 0.03},
    "ORAL_DRUG": {"decay_rate": 0.08, "floor_factor": 0.65, "resistance_rate": 0.05},
}

def _require_model_artifacts():
    if encoder is None or scaler is None or genomic_features is None or not models:
        raise HTTPException(status_code=503, detail="Service not ready. Missing artifacts.")

def _run_multimodal_inference_logic(request: MultimodalRequest):
    _require_model_artifacts()
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
    X_integrated = np.hstack([X_num, X_cat, [mut_vector]])
    
    vision_confidence = 0.5
    has_image = False
    if request.image and profile.primary_site.lower() == 'breast':
        v_vec = vision_encoder.get_embeddings(request.image)
        if vision_detector:
            vision_confidence = float(vision_detector.predict_proba(v_vec)[0][1])
        has_image = True

    risks = {}
    total_lift = 0.0
    for site, model in models.items():
        prob_base = float(model.predict_proba(X_integrated)[0][1])
        prob_final = prob_base
        
        if has_image and vision_confidence > 0.7 and site == 'DMETS_DX_DIST_LN':
            prob_final = min(0.95, prob_base + 0.35)
        elif has_image and vision_confidence < 0.3 and site == 'DMETS_DX_DIST_LN':
            prob_final = max(0.01, prob_base - 0.20)
            
        risks[site] = round(prob_final, 4)
        total_lift += (prob_final - prob_base)

    return {
        "simulated_risks": risks,
        "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
        "has_visual_data": has_image,
        "vision_confidence": round(vision_confidence, 4)
    }

def project_temporal_risk_logic(base_risk: float, month: int, mode: str, treatment: Optional[str]):
    if month == 0: return round(base_risk, 6)
    if mode == "untreated":
        growth_rate = 0.04 + (base_risk * 0.24)
        capacity = min(0.995, base_risk + (1.0 - base_risk) * (0.55 + 0.25 * base_risk))
        risk = capacity - (capacity - base_risk) * np.exp(-growth_rate * month)
    else:
        coeff = TREATMENT_COEFFICIENTS.get(treatment, TREATMENT_COEFFICIENTS["CHEMOTHERAPY"])
        floor = max(0.002, base_risk * coeff["floor_factor"])
        decay = floor + (base_risk - floor) * np.exp(-coeff["decay_rate"] * month)
        resist = coeff["resistance_rate"] * (1 - np.exp(-0.12 * max(0, month - 6)))
        risk = decay + resist * (1 - decay)
    return round(float(np.clip(risk, 0.0, 0.999)), 6)

@app.post("/simulate")
def simulate_risk(request: MultimodalRequest):
    try:
        return _run_multimodal_inference_logic(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate/temporal")
def simulate_temporal_risk(request: TemporalSimulationRequest):
    try:
        base_res = _run_multimodal_inference_logic(MultimodalRequest(profile=request.profile, image=request.image))
        baseline = base_res["simulated_risks"]
        timeline = []
        for m in range(request.months + 1):
            m_risks = {s: project_temporal_risk_logic(float(r), m, request.mode, request.treatment) for s, r in baseline.items()}
            vals = list(m_risks.values())
            timeline.append({
                "month": m,
                "risks": m_risks,
                "max_risk": round(float(np.max(vals)), 4),
                "mean_risk": round(float(np.mean(vals)), 4)
            })
        return {
            "mode": request.mode,
            "treatment": request.treatment,
            "months": request.months,
            "baseline_risks": baseline,
            "timeline": timeline,
            "visual_lift": base_res["visual_lift"],
            "has_visual_data": base_res["has_visual_data"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/timeline")
async def predict_timeline(request: PredictTimelineRequest):
    explain_req = TimelineExplainRequest(
        primary_site=request.profile.primary_site,
        mutations=[m for m, v in request.profile.mutations.items() if v > 0],
        risks=request.risks,
        treatment=request.treatment,
        months=request.months,
        selected_organ=request.organ or "Metastatic Target"
    )
    result = await timeline_service.predict_treatment_timeline(explain_req)
    return {
        "prediction_id": f"sim_{str(uuid4())[:8]}",
        "status": result.status,
        "trajectories": {s: [p.model_dump() for p in pts] for s, pts in result.trajectories.items()},
        "summary": result.summary
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
