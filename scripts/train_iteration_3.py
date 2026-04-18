"""
================================================================================
FILE: train_iteration_3.py
ROLE: The "Total Body" Batch Trainer
PURPOSE: This script automates the training of predictive models for ALL 
         metastatic sites (21 total) in the MSK-MET dataset. 
         
LEARNING POINTS:
- DYNAMIC DISCOVERY: We don't hardcode targets anymore. The script finds them.
- MODEL SERIALIZATION: We use joblib to save our models so they can be "reused"
  by the API in Phase 3 without retraining.
- SCALABILITY: Notice how the core logic is abstracted into a loop to handle
  dozens of targets efficiently.
================================================================================
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score
import joblib
import os

# Configuration
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'
MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'
EMBEDDINGS_PATH = 'data/image_embeddings.csv'
os.makedirs(MODEL_DIR, exist_ok=True)

CLINICAL_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

def load_and_preprocess():
    print(f"Loading multi-omic data from {os.path.basename(DATA_PATH)}...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # 2. Integrate Multimodal Alignment Seed [FIX]
    SEED_PATH = 'data/multimodal_alignment_seed.csv'
    if os.path.exists(SEED_PATH):
        seed_df = pd.read_csv(SEED_PATH)
        print(f"Injecting {len(seed_df)} Aligned Medical Twins into training set...")
        
        # Ensure column consistency for the merge/concat
        twin_ids = seed_df['PATIENT_ID'].unique()
        df = df[~df['PATIENT_ID'].isin(twin_ids)] # remove original placeholders
        df = pd.concat([df, seed_df], ignore_index=True)

        # Re-identify vision feature columns
        VISION_COLS = [c for c in seed_df.columns if c.startswith('v_feat_')]
        
        # Set sample weights: 500x boost for patients WITH images
        df['SAMPLE_WEIGHT'] = 1.0
        df.loc[df[VISION_COLS[0]].notna(), 'SAMPLE_WEIGHT'] = 500.0
        
        df['HAS_IMAGE'] = df[VISION_COLS[0]].notna().astype(int)
        
        # Final cleanup for vision features
        df[VISION_COLS] = df[VISION_COLS].fillna(0) # or mean
        print(f"Multimodal balance: {df['HAS_IMAGE'].sum()} with images / {len(df)} total.")
    else:
        df['SAMPLE_WEIGHT'] = 1.0
        VISION_COLS = []
        df['HAS_IMAGE'] = 0

    # Identify all possible target sites (DMETS_DX)
    all_dmet_cols = [c for c in df.columns if 'DMETS_DX' in c]
    
    # Filter targets with enough data (> 100 cases for stability)
    VALID_TARGETS = [c for c in all_dmet_cols if (df[c] == 'Yes').sum() > 100]
    print(f"Dynamic Discovery: Found {len(VALID_TARGETS)} valid metastatic sites.")
    
    # Transformation
    for col in VALID_TARGETS:
        df[col] = df[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # Imputation
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    # Preprocessing
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(df[cat_cols])
    X_num = scaler.fit_transform(df[num_cols])
    
    # Exclude columns from genomic set
    excluded = CLINICAL_COLS + [c for c in df.columns if 'DMETS_DX' in c] + ['PATIENT_ID', 'SAMPLE_ID', 'SAMPLE_WEIGHT', 'HAS_IMAGE'] + VISION_COLS
    GENOMIC_COLS = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    X_genomic = df[GENOMIC_COLS].values
    
    # Vision Stack
    if VISION_COLS:
        X_vision = df[VISION_COLS].values
        X_indicator = df[['HAS_IMAGE']].values
        X = np.hstack([X_num, X_cat, X_genomic, X_vision, X_indicator])
    else:
        X = np.hstack([X_num, X_cat, X_genomic])

    # Save mapping metadata
    joblib.dump(encoder, os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    joblib.dump(GENOMIC_COLS, os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    if VISION_COLS:
        joblib.dump(VISION_COLS, os.path.join(MODEL_DIR, 'vision_features.joblib'))

    return df, X, VALID_TARGETS

def train_all_models(df, X_global, targets):
    summary = []
    weights = df['SAMPLE_WEIGHT'].values
    
    for site in targets:
        print(f"Training Model (Weighted): {site}")
        y = df[site]
        
        # Cross-validation with Weight implementation
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        
        # 1. Baseline
        aucs_clin = []
        # (Clinical logic...)
        
        # 3. Multimodal (Soil + Seed + Eyes)
        aucs_multi = []
        for train_idx, val_idx in skf.split(X_global, y):
            model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
            # APPLY WEIGHTS HERE
            model.fit(X_global[train_idx], y.iloc[train_idx], sample_weight=weights[train_idx])
            probs = model.predict_proba(X_global[val_idx])[:, 1]
            aucs_multi.append(roc_auc_score(y.iloc[val_idx], probs))
        
        mean_auc_multi = np.mean(aucs_multi)
        print(f"   Weighted Multimodal AUC: {mean_auc_multi:.4f}")
        
        # Final Fit and Save BEST model
        model.fit(X_global, y, sample_weight=weights)
        joblib.dump(model, os.path.join(MODEL_DIR, f"model_{site.lower()}.joblib"))
        
        summary.append({
            'Site': site, 
            'Weighted_AUC': mean_auc_multi,
            'Has_Image_Boost': True,
            'Count': y.sum()
        })

    return pd.DataFrame(summary)

if __name__ == "__main__":
    df, X, targets = load_and_preprocess()
    report = train_all_models(df, X, targets)
    
    # Sort by Weighted AUC to see the highest performing sites
    report.sort_values(by='Weighted_AUC', ascending=False, inplace=True)
    
    print("\n" + "="*80)
    print("      GLOBAL ACCURACY REPORT (MULTIMODAL FUSION AUDIT)")
    print("="*80)
    print(report.to_string(index=False))
    
    report.to_csv(os.path.join(MODEL_DIR, 'global_site_report_multimodal.csv'), index=False)
    print(f"All {len(targets)} models re-trained with vision embeddings. Report saved.")
