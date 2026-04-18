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

@app.on_event("startup")
def startup_event():
    global encoder, scaler, genomic_features, vision_features, models, vision_encoder, mean_vision_vector
    import traceback
    try:
        print("Initializing AI Service Artifacts...")
        encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
        scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
        genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
        vision_features = joblib.load(os.path.join(MODEL_DIR, 'vision_features.joblib'))
        
        # 1. Initialize Vision Model (The Eyes)
        vision_encoder = VisionEncoder()
        
        # 2. Load Mean Vector for Imputation
        if os.path.exists(REAL_DATA_PATH):
            df_real = pd.read_csv(REAL_DATA_PATH)
            # Ensure we only pick numeric columns
            numeric_vision = [c for c in vision_features if c in df_real.columns]
            mean_vision_vector = df_real[numeric_vision].mean().values
            print("Loaded reference library for imputation.")
        else:
            mean_vision_vector = np.zeros(len(vision_features))
            print("Warning: No reference library found. Using zero-imputation.")

        # 3. Discovery available models
        model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_') and f.endswith('.joblib')]
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
    return {"status": "online", "multimodal": True, "models_loaded": list(models.keys())}

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
        
        # --- 2. MULTIMODAL INFERENCE (The "Visual Lift") ---
        # Tier A: Baseline (Soil + Seed) - Use mean vector and HAS_IMAGE=0
        X_baseline = np.hstack([X_num, X_cat, X_genomic, mean_vision_vector.reshape(1, -1), [[0]]])
        
        # Tier B: Multimodal (Soil + Seed + Eyes)
        if request.image:
            # Extract real embedding from Base64
            v_vec = vision_encoder.get_embeddings(request.image)
            X_actual = np.hstack([X_num, X_cat, X_genomic, v_vec, [[1]]])
            has_image = True
        else:
            X_actual = X_baseline
            has_image = False

        # --- 3. BATCH INFERENCE ---
        risks = {}
        total_lift = 0.0
        for site, model in models.items():
            # Risk without image
            prob_base = float(model.predict_proba(X_baseline)[0][1])
            # Risk with image
            prob_actual = float(model.predict_proba(X_actual)[0][1])
            
            risks[site] = prob_actual
            if has_image:
                total_lift += (prob_actual - prob_base)
            
        return {
            "simulated_risks": risks,
            "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
            "has_visual_data": has_image
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
