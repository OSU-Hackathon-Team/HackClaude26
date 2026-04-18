from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, List, Optional
from scripts.extract_embeddings import VisionEncoder

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
vision_detector = None # Level 2 Ensemble Signal (The "Eyes")
supabase: Optional[Client] = None

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
        
        # 1. Initialize Vision Model (The Eyes)
        vision_encoder = VisionEncoder()
        
        # 2. Load Vision Detector (The Level 2 Ensemble Signal)
        detector_path = os.path.join(MODEL_DIR, 'vision_detector.joblib')
        if os.path.exists(detector_path):
            vision_detector = joblib.load(detector_path)
            print("Vision Detector online (Decision Engine Layer 2).")

        # 4. Discovery available models
        model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_' ) and f.endswith('.joblib')]
        models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
        
        print(f"API Startup Complete: {len(models)} sites operational.")
    except Exception as e:
        print(f"Startup Failure Traceback:")
        traceback.print_exc()

class PatientProfile(BaseModel):
    name: str # Add name for clinician visibility
    age: float
    sex: str
    primary_site: str
    oncotree_code: str
    mutations: Dict[str, int]

class MultimodalRequest(BaseModel):
    profile: PatientProfile
    image: Optional[str] = None # Base64 encoded slide
    doctor_id: Optional[str] = None # To be populated by Clerk userId

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
        
        # --- 2. MULTIMODAL INFERENCE ---
        # Stage 1: Genomic Baseline (Actual models expect 372 features)
        X_baseline = np.hstack([X_num, X_cat, X_genomic])
        
        has_image = False
        vision_confidence = 0.5 # Neutral baseline
        is_vision_conclusive = False
        
        if request.image:
            # Extract real embedding for the Vision Validator
            v_vec = vision_encoder.get_embeddings(request.image)
            
            # Stage 2: Ensemble Signal (The "Visual Validation")
            if vision_detector:
                vision_confidence = float(vision_detector.predict_proba(v_vec)[0][1])
                # Check for conclusivity (>70% or <30%)
                if vision_confidence > 0.7 or vision_confidence < 0.3:
                    is_vision_conclusive = True
            has_image = True

        # --- 3. BATCH INFERENCE & ENSEMBLE FUSION ---
        risks = {}
        total_lift = 0.0
        
        # 4. CLINICAL SAFETY NET (Heuristic logic for high-risk profiles)
        # Based on NCCN/ESMO guidelines for metastatic risk profiles
        is_high_risk_genomic = False
        code = profile.oncotree_code.upper()
        muts = profile.mutations
        
        if code in ["COAD", "READ", "COADREAD"]:
            # Colorectal: KRAS/BRAF/SMAD4 are high-risk drivers
            if muts.get("KRAS") or muts.get("BRAF") or muts.get("SMAD4"):
                is_high_risk_genomic = True
        elif code in ["LUAD", "LUSC", "NSCLC"]:
            # Lung: EGFR/ALK/ROS1 or KRAS
            if muts.get("EGFR") or muts.get("ALK") or muts.get("ROS1") or muts.get("KRAS"):
                is_high_risk_genomic = True
        elif code in ["BRCA", "IDC", "ILC"]:
            # Breast: TP53 or PIK3CA or ERBB2 (HER2)
            if muts.get("TP53") or muts.get("PIK3CA") or muts.get("ERBB2"):
                is_high_risk_genomic = True
        elif code in ["PAAD"]:
            # Pancreas: Almost always high risk, but specifically KRAS/SMAD4
            if muts.get("KRAS") or muts.get("SMAD4"):
                is_high_risk_genomic = True

        for site, model in models.items():
            # 1. Get stable genomic risk (372-feature model)
            prob_base = float(model.predict_proba(X_baseline)[0][1])
            
            # 2. Apply Dynamic Beta-weighted Fusion
            if is_vision_conclusive:
                if vision_confidence > 0.7:
                    # Positive Lift: Linear scaling from baseline to 0.95
                    # Lift intensity is proportional to confidence beyond threshold
                    lift = (vision_confidence - 0.7) / 0.3 * 0.4 
                    prob_final = min(0.95, prob_base + lift)
                else:
                    # Negative Drain: Reduce risk if vision is very sure it's normal
                    drain = (0.3 - vision_confidence) / 0.3 * 0.2
                    prob_final = max(0.01, prob_base - drain)
            else:
                # Neutral: Fallback to Genomic Baseline
                prob_final = prob_base

            # 3. Apply Clinical Safety Net (Floor)
            if is_high_risk_genomic:
                # Ensure risk is at least 25% for high-driver mutations in COAD
                prob_final = max(prob_final, 0.25)
            
            risks[site] = round(prob_final, 4)
            if has_image:
                total_lift += (prob_final - prob_base)
            
        # --- 4. PERSIST TO SUPABASE ---
        if supabase:
            try:
                # 1. Upsert Patient
                p_data = {
                    "name": profile.name,
                    "age": profile.age,
                    "sex": profile.sex,
                    "primary_site": profile.primary_site,
                    "oncotree_code": profile.oncotree_code,
                    "mutations": profile.mutations
                }
                # Find patient by name (simplification for demo)
                p_res = supabase.table("patients").upsert(p_data, on_conflict="name").execute()
                if p_res.data:
                    p_id = p_res.data[0]['id']
                    
                    # 2. Log Simulation
                    s_data = {
                        "patient_id": p_id,
                        "doctor_id": request.doctor_id,
                        "vision_confidence": round(vision_confidence, 4),
                        "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
                        "risks": risks,
                        "image_url": "dashboard_upload" # simplified pointer
                    }
                    supabase.table("simulations").insert(s_data).execute()
                    print(f"Simulation logged for {profile.name} (Dr: {request.doctor_id})")
            except Exception as db_e:
                print(f"Database Persistence Warning: {db_e}")

        return {
            "simulated_risks": risks,
            "visual_lift": round(total_lift / len(models), 4) if has_image else 0.0,
            "has_visual_data": has_image,
            "vision_confidence": round(vision_confidence, 4),
            "is_vision_conclusive": is_vision_conclusive,
            "is_high_risk_genomic": is_high_risk_genomic
        }
        
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
