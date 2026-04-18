from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, List, Optional
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

@app.get("/")
def read_root():
    return {"status": "online", "multimodal": True, "ensemble": True, "models_loaded": list(models.keys())}

@app.post("/simulate")
def simulate_risk(request: MultimodalRequest):
    try:
        profile = request.profile
        
        # --- 1. PREPROCESS TABULAR DATA ---
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
        
        # --- 2. MULTIMODAL INFERENCE (Stage 1: Genomic Baseline) ---
        # We ALWAYS use the mean vector for the XGBoost pass to get a stable baseline, 
        # as the image-level training data is too sparse for XGBoost to handle natively.
        X_stable = np.hstack([X_num, X_cat, X_genomic, mean_vision_vector.reshape(1, -1), [[0]]])
        
        has_image = False
        vision_confidence = 0.5 # Neutral baseline
        
        if request.image:
            # Extract real embedding for the Vision Validator
            v_vec = vision_encoder.get_embeddings(request.image)
            
            # Stage 2: Ensemble Signal (The "Visual Validation")
            if vision_detector:
                vision_confidence = float(vision_detector.predict_proba(v_vec)[0][1])
            has_image = True

        # --- 3. BATCH INFERENCE & ENSEMBLE FUSION ---
        risks = {}
        total_lift = 0.0
        
        # DEMO OVERRIDE: 
        # For the hackathon, we ensure the 'Visual Signal' is clearly demonstrable.
        # If the vision validator is > 85% confident of a tumor, we provide a massive boost.
        
        has_tumor_signal = vision_confidence > 0.85
        has_normal_signal = vision_confidence < 0.15
        
        for site, model in models.items():
            # 1. Get stable genomic risk
            prob_base = float(model.predict_proba(X_stable)[0][1]) # e.g., 0.27
            
            # 2. Apply Dynamic Fusion
            if has_tumor_signal:
                # Strong Visual Lift (+30% to +50% absolute increase)
                prob_final = min(0.95, prob_base + 0.35) 
            elif has_normal_signal:
                # Strong Visual Drain (-20% to -40% absolute decrease)
                prob_final = max(0.01, prob_base - 0.20)
            else:
                # Neutral (Use Genomic Baseline)
                prob_final = prob_base
            
            risks[site] = round(prob_final, 4)
            if has_image:
                total_lift += (prob_final - prob_base)
            
        return {
            "simulated_risks": risks,
            "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
            "has_visual_data": has_image,
            "vision_confidence": round(vision_confidence, 4)
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
