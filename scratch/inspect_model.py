import joblib
import os
import numpy as np
import pandas as pd
import xgboost as xgb

MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'
model_path = os.path.join(MODEL_DIR, 'model_dmets_dx_liver.joblib')
genomic_path = os.path.join(MODEL_DIR, 'genomic_features.joblib')
clinical_enc_path = os.path.join(MODEL_DIR, 'clinical_encoder.joblib')

if os.path.exists(model_path):
    model = joblib.load(model_path)
    genomic_features = joblib.load(genomic_path)
    encoder = joblib.load(clinical_enc_path)
    
    # Get feature names from encoder
    # encoder is OneHotEncoder
    cat_features = []
    for i, col in enumerate(['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']):
        cat_features.extend([f"{col}_{val}" for val in encoder.categories_[i]])
    
    all_features = ['AGE_AT_SEQUENCING'] + cat_features + genomic_features
    # Check if vision features were added during training
    vision_path = os.path.join(MODEL_DIR, 'vision_features.joblib')
    if os.path.exists(vision_path):
        vision_features = joblib.load(vision_path)
        all_features += vision_features + ['HAS_IMAGE']

    print(f"Total features in list: {len(all_features)}")
    
    # XGBoost internal feature names are f0, f1, f2...
    # We can map them
    importance = model.get_booster().get_score(importance_type='gain')
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    
    print("\nTop 20 Features (by Gain):")
    for fid, score in sorted_imp[:20]:
        idx = int(fid[1:])
        if idx < len(all_features):
            print(f"  {all_features[idx]}: {score:.4f}")
        else:
            print(f"  Unknown(f{idx}): {score:.4f}")

    # Check specific genes
    for gene in ['KRAS', 'BRAF', 'SMAD4', 'APC', 'TP53']:
        if gene in genomic_features:
            idx = all_features.index(gene)
            gain = importance.get(f'f{idx}', 0)
            print(f"{gene} (f{idx}) Gain: {gain:.4f}")
        else:
            print(f"{gene} NOT in genomic features")
else:
    print("Model not found")
