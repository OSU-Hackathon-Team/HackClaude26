"""
================================================================================
FILE: train_iteration_3.py
ROLE: The "Total Body" Batch Trainer (Multimodal Edition)
PURPOSE: This script automates the training of predictive models for ALL 
         metastatic sites (21 total) in the MSK-MET dataset, integrating
         Pathology imaging features with Clinical and Genomic data.
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
os.makedirs(MODEL_DIR, exist_ok=True)

CLINICAL_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

def load_and_preprocess():
    print(f"Loading multi-omic data from {os.path.basename(DATA_PATH)}...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # 1. Integrate Multimodal Alignment Seed
    SEED_PATH = 'data/multimodal_alignment_seed.csv'
    if os.path.exists(SEED_PATH):
        seed_df = pd.read_csv(SEED_PATH)
        print(f"Injecting {len(seed_df)} Aligned Medical Twins into training set...")
        
        # Ensure column consistency for the merge/concat
        twin_ids = seed_df['PATIENT_ID'].unique()
        df = df[~df['PATIENT_ID'].isin(twin_ids)] # remove original placeholders
        df = pd.concat([df, seed_df], ignore_index=True)

        VISION_COLS = [c for c in seed_df.columns if c.startswith('v_feat_')]
        
        # Set sample weights: 50x boost for patients WITH images (down from 500x)
        df['SAMPLE_WEIGHT'] = 1.0
        df.loc[df[VISION_COLS[0]].notna(), 'SAMPLE_WEIGHT'] = 50.0
        
        df['HAS_IMAGE'] = df[VISION_COLS[0]].notna().astype(int)
        
        # Final cleanup for vision features
        df[VISION_COLS] = df[VISION_COLS].fillna(0) # Standard 0-fill for baseline
        print(f"Multimodal balance: {df['HAS_IMAGE'].sum()} with images / {len(df)} total.")
    else:
        print("Warning: No multimodal seed found. Training clinical/genomic only.")
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
    
    X_clinical_raw = df[CLINICAL_COLS]
    
    # Strict Leakage Purge (The User's Accurate Baseline)
    leakage_cols = [
        'AGE_AT_DEATH', 'AGE_AT_EVIDENCE_OF_METS', 'AGE_AT_LAST_CONTACT', 
        'AGE_AT_SURGERY', 'OS_STATUS', 'OS_MONTHS', 'METASTATIC_SITE', 
        'MET_COUNT', 'MET_SITE_COUNT', 'IS_DIST_MET_MAPPED'
    ]
    other_metadata = [
        'SAMPLE_ID', 'PATIENT_ID', 'ORGAN_SYSTEM', 'SUBTYPE', 'SAMPLE_TYPE', 
        'PRIMARY_SITE_GROUPS', 'CANCER_TYPE', 'CANCER_TYPE_DETAILED', 
        'MSI_SCORE', 'MSI_TYPE', 'TMB_NONSYNONYMOUS', 'TUMOR_PURITY', 
        'GENE_PANEL', 'SAMPLE_COVERAGE', 'RACE'
    ]
    
    excluded = CLINICAL_COLS + all_dmet_cols + leakage_cols + other_metadata + ['HAS_IMAGE', 'SAMPLE_WEIGHT'] + VISION_COLS
    
    GENOMIC_COLS = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    # Preprocessing
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(X_clinical_raw[cat_cols])
    X_num = scaler.fit_transform(X_clinical_raw[num_cols])
    X_genomic = df[GENOMIC_COLS].values
    
    # Stack features: [Num, Cat, Genomic, Vision, Indicator]
    if VISION_COLS:
        X_vision = df[VISION_COLS].values
        X_indicator = df[['HAS_IMAGE']].values
        X = np.hstack([X_num, X_cat, X_genomic, X_vision, X_indicator])
    else:
        X = np.hstack([X_num, X_cat, X_genomic])
    
    # Save artifacts
    joblib.dump(encoder, os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    joblib.dump(GENOMIC_COLS, os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    if VISION_COLS:
        joblib.dump(VISION_COLS, os.path.join(MODEL_DIR, 'vision_features.joblib'))
    
    print(f"Preprocessing complete. Feature count: {X.shape[1]}")
    return df, X, VALID_TARGETS

def train_all_models(df, X_global, targets):
    summary = []
    weights = df['SAMPLE_WEIGHT'].values
    
    for site in targets:
        print(f"\nTraining Model: {site}")
        y = df[site]
        
        # Cross-validation with weights
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        
        aucs_multi = []
        for train_idx, val_idx in skf.split(X_global, y):
            model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
            model.fit(X_global[train_idx], y.iloc[train_idx], sample_weight=weights[train_idx])
            probs = model.predict_proba(X_global[val_idx])[:, 1]
            aucs_multi.append(roc_auc_score(y.iloc[val_idx], probs))
        
        mean_auc_multi = np.mean(aucs_multi)
        print(f"   Weighted Multimodal AUC: {mean_auc_multi:.4f}")
        
        # Final Fit
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
    
    report.sort_values(by='Weighted_AUC', ascending=False, inplace=True)
    print("\n" + "="*80)
    print("      GLOBAL ACCURACY REPORT (MULTIMODAL FUSION AUDIT)")
    print("="*80)
    print(report.to_string(index=False))
    
    report.to_csv(os.path.join(MODEL_DIR, 'global_site_report_multimodal.csv'), index=False)
    print(f"All {len(targets)} models re-trained with vision embeddings.")
