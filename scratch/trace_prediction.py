import joblib
import pandas as pd
import numpy as np
import os

# Configuration
MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'

# Load artifacts
encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
vision_features = joblib.load(os.path.join(MODEL_DIR, 'vision_features.joblib'))
model = joblib.load(os.path.join(MODEL_DIR, 'model_dmets_dx_liver.joblib'))

# Test Patient (matches verify_liver_tropism.py)
profile_muts = {"APC": 1, "KRAS": 1, "TP53": 1, "SMAD4": 1, "BRAF": 1}
profile_age = 62
profile_sex = "Male"
profile_site = "Colon"
profile_code = "COAD"

# 1. Preprocess
clinical_raw = pd.DataFrame([{
    'AGE_AT_SEQUENCING': profile_age,
    'SEX': profile_sex,
    'PRIMARY_SITE': profile_site,
    'ONCOTREE_CODE': profile_code
}])

X_num = scaler.transform(clinical_raw[['AGE_AT_SEQUENCING']])
X_cat = encoder.transform(clinical_raw[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])
mut_vector = [profile_muts.get(feat, 0) for feat in genomic_features]
X_genomic = np.array([mut_vector])

print(f"Genomic mutations found in vector: {sum(mut_vector)}")
for gene in ["KRAS", "BRAF", "SMAD4"]:
    if gene in genomic_features:
        idx = genomic_features.index(gene)
        print(f"  {gene} in vector at index {idx}: {mut_vector[idx]}")
    else:
        print(f"  {gene} NOT in genomic features list")

# 2. Baseline
baseline_vision_vector = np.zeros(len(vision_features))
X_stable = np.hstack([X_num, X_cat, X_genomic, baseline_vision_vector.reshape(1, -1), [[0]]])

print(f"X_stable shape: {X_stable.shape}")
prob_base = float(model.predict_proba(X_stable)[0][1])
print(f"Prob Base (Model Prediction): {prob_base:.4f}")

# 3. Safety Net
is_high_risk_genomic = False
if profile_code in ["COAD", "READ", "COADREAD"]:
    if profile_muts.get("KRAS") or profile_muts.get("BRAF") or profile_muts.get("SMAD4"):
        is_high_risk_genomic = True
print(f"Is High Risk Genomic: {is_high_risk_genomic}")

prob_final = prob_base
if is_high_risk_genomic:
    prob_final = max(prob_final, 0.25)

print(f"Prob Final: {prob_final:.4f}")
