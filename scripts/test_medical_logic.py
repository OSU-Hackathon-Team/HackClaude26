import pandas as pd
import numpy as np
import joblib
import os

# Configuration (using the validated path)
MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'

def test_medical_combinations():
    print("VALIDATING MEDICAL PLAUSIBILITY...")
    
    # 1. Load Preprocessing Artifacts
    encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    
    # Load Models
    model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_') and f.endswith('.joblib')]
    models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
    
    # Define Test Cases
    # Case 1: Colorectal Cancer (High Liver Risk)
    patient_1 = {
        "name": "Colorectal Pattern (Colon -> Liver)",
        "age": 65, "sex": "Male", "primary_site": "COLON", "oncotree_code": "COAD",
        "mutations": {"KRAS": 1, "TP53": 1}
    }
    
    # Case 2: Prostate Cancer (High Bone Risk)
    patient_2 = {
        "name": "Prostate Pattern (Prostate -> Bone)",
        "age": 70, "sex": "Male", "primary_site": "PROSTATE", "oncotree_code": "PRAD",
        "mutations": {"SPOP": 1}
    }

    for p in [patient_1, patient_2]:
        print(f"\nTesting: {p['name']}")
        
        # Preprocess
        clin_raw = pd.DataFrame([{
            'AGE_AT_SEQUENCING': p['age'],
            'SEX': p['sex'],
            'PRIMARY_SITE': p['primary_site'],
            'ONCOTREE_CODE': p['oncotree_code']
        }])
        
        X_num = scaler.transform(clin_raw[['AGE_AT_SEQUENCING']])
        X_cat = encoder.transform(clin_raw[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])
        
        mut_vector = [p['mutations'].get(feat, 0) for feat in genomic_features]
        X_genomic = np.array([mut_vector])
        
        X = np.hstack([X_num, X_cat, X_genomic])
        
        # Predict across all organs
        results = {}
        for site, model in models.items():
            prob = model.predict_proba(X)[0][1]
            results[site] = prob
            
        # Show Top 3 Risks
        sorted_risks = sorted(results.items(), key=lambda x: x[1], reverse=True)[:3]
        for site, prob in sorted_risks:
            print(f"   -> {site}: {prob*100:.1f}%")

if __name__ == "__main__":
    test_medical_combinations()
