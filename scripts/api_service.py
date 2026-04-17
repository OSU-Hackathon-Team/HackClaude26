"""
================================================================================
FILE: api_service.py
ROLE: The "What-If" Inference Engine
PURPOSE: This FastAPI service serves our 21 trained models. It allows a user
         to send a patient profile (Age, Sex, Site, Mutations) and receive
         a real-time risk heatmap for the entire body.
         
LEARNING POINTS:
- REST API: We are exposing our models through a standard web interface.
- REAL-TIME SIMULATION: The user can change a gene mutation and see how the 
  "Soil" risk changes across multiple organs simultaneously.
- MODULARITY: The API loads the models once at startup (Caching) so that 
  inference is lightning fast.
================================================================================
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, List

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OncoPath Risk Simulator API")

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

# Load artifacts needed for preprocessing
try:
    encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    
    # Discovery available models
    model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_') and f.endswith('.joblib')]
    models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
    
    print(f"🚀 API Startup: Loaded {len(models)} site models.")
except Exception as e:
    print(f"❌ Error loading models: {e}")

class PatientProfile(BaseModel):
    age: float
    sex: str # Male, Female
    primary_site: str
    oncotree_code: str
    mutations: Dict[str, int] # e.g., {"TP53": 1, "KRAS": 0}

@app.get("/")
def read_root():
    return {"status": "online", "models_loaded": list(models.keys())}

@app.post("/simulate")
def simulate_risk(profile: PatientProfile):
    try:
        # 1. Preprocess Clinical Data
        # We need to match the exact format used in training
        clinical_raw = pd.DataFrame([{
            'AGE_AT_SEQUENCING': profile.age,
            'SEX': profile.sex,
            'PRIMARY_SITE': profile.primary_site,
            'ONCOTREE_CODE': profile.oncotree_code
        }])
        
        # Scaling & Encoding
        X_num = scaler.transform(clinical_raw[['AGE_AT_SEQUENCING']])
        X_cat = encoder.transform(clinical_raw[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])
        
        # 2. Preprocess Genomic Data
        # Ensure all 50 features are present, default to 0 if not provided
        mut_vector = []
        for feat in genomic_features:
            mut_vector.append(profile.mutations.get(feat, 0))
        X_genomic = np.array([mut_vector])
        
        # Combine
        X = np.hstack([X_num, X_cat, X_genomic])
        
        # 3. Batch Inference
        risks = {}
        for site, model in models.items():
            # Get the probability of 'Yes' (class 1)
            prob = model.predict_proba(X)[0][1]
            risks[site] = float(prob)
            
        return {
            "patient_age": profile.age,
            "primary_site": profile.primary_site,
            "simulated_risks": risks
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
