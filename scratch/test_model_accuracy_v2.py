import joblib
import pandas as pd
import numpy as np
import os
import sys
from sklearn.metrics import roc_auc_score

# Relative paths for this environment
MODEL_DIR = 'models'
DATA_PATH = 'data/multimodal_alignment_seed.csv'

def test_accuracy():
    print("--- DEBUG: Starting Test ---")
    print(f"Current Working Directory: {os.getcwd()}")
    
    if not os.path.exists(DATA_PATH):
        print(f"Error: Data file {DATA_PATH} not found.")
        return

    print("Loading data...")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} samples.")

    print("Loading preprocessing artifacts...")
    try:
        encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
        scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
        genomic_cols = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
        print("Preprocessing artifacts loaded.")
    except Exception as e:
        print(f"Error loading artifacts: {e}")
        return

    # Preprocess a small sample
    print("Preprocessing data...")
    X_num = scaler.transform(df[['AGE_AT_SEQUENCING']].fillna(50))
    X_cat = encoder.transform(df[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']].fillna('Unknown'))
    X_genomic = df[genomic_cols].fillna(0).values
    
    vision_cols = [c for c in df.columns if c.startswith('v_feat_')]
    if vision_cols:
        X_vision = df[vision_cols].fillna(0).values
        X_indicator = np.ones((len(df), 1))
        X_multimodal = np.hstack([X_num, X_cat, X_genomic, X_vision, X_indicator])
    else:
        X_multimodal = np.hstack([X_num, X_cat, X_genomic])
    print(f"X_multimodal shape: {X_multimodal.shape}")

    # Test LIVER model
    target = 'DMETS_DX_LIVER'
    model_file = os.path.join(MODEL_DIR, f"model_{target.lower()}.joblib")
    print(f"Loading model from {model_file}...")
    
    if os.path.exists(model_file):
        model = joblib.load(model_file)
        print("Model loaded.")
        y_true = df[target].map({'Yes': 1, 'No': 0}).fillna(0).values
        
        if len(np.unique(y_true)) > 1:
            y_prob = model.predict_proba(X_multimodal)[:, 1]
            auc = roc_auc_score(y_true, y_prob)
            print(f"SUCCESS: {target} ROC AUC = {auc:.4f}")
        else:
            print(f"Skipping {target}: Only one class present.")
    else:
        print(f"Model file {model_file} not found.")

if __name__ == "__main__":
    test_accuracy()
