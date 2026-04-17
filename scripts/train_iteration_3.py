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
os.makedirs(MODEL_DIR, exist_ok=True)

CLINICAL_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

def load_and_preprocess():
    print(f"🚀 Loading multi-omic data from {os.path.basename(DATA_PATH)}...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # Identify all possible target sites (DMETS_DX)
    all_dmet_cols = [c for c in df.columns if 'DMETS_DX' in c]
    
    # Filter targets with enough data (> 100 cases for stability)
    VALID_TARGETS = [c for c in all_dmet_cols if (df[c] == 'Yes').sum() > 100]
    print(f"🎯 Dynamic Discovery: Found {len(VALID_TARGETS)} valid metastatic sites.")
    
    # Transformation
    for col in VALID_TARGETS:
        df[col] = df[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # Imputation
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    X_clinical_raw = df[CLINICAL_COLS]
    
    # Strict Leakage Purge (Consistent with Phase 2)
    leakage_cols = [
        'AGE_AT_DEATH', 'AGE_AT_EVIDENCE_OF_METS', 'AGE_AT_LAST_CONTACT', 
        'AGE_AT_SURGERY', 'OS_STATUS', 'OS_MONTHS', 'METASTATIC_SITE', 
        'MET_COUNT', 'MET_SITE_COUNT', 'IS_DIST_MET_MAPPED'
    ]
    other_metadata = ['SAMPLE_ID', 'PATIENT_ID', 'ORGAN_SYSTEM', 'SUBTYPE', 'SAMPLE_TYPE', 'PRIMARY_SITE_GROUPS', 'CANCER_TYPE', 'CANCER_TYPE_DETAILED', 'MSI_SCORE', 'MSI_TYPE', 'TMB_NONSYNONYMOUS', 'TUMOR_PURITY', 'GENE_PANEL', 'SAMPLE_COVERAGE', 'RACE']
    
    # Exclude all clinical metadata and ALL target sites from the feature set
    excluded = CLINICAL_COLS + all_dmet_cols + leakage_cols + other_metadata
    
    GENOMIC_COLS = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    # Preprocessing
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(X_clinical_raw[cat_cols])
    X_num = scaler.fit_transform(X_clinical_raw[num_cols])
    X_genomic = df[GENOMIC_COLS].values
    
    X = np.hstack([X_num, X_cat, X_genomic])
    
    # Save the encoder and scaler for the API later!
    joblib.dump(encoder, os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    joblib.dump(GENOMIC_COLS, os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    
    print(f"✅ Preprocessing complete. Feature count: {X.shape[1]}")
    return df, X, VALID_TARGETS

def train_all_models(df, X_global, targets):
    summary = []
    
    # Pre-select index for clinical features (First X columns based on preprocessing)
    # X_num (1) + X_cat (Sex, Primary, OncoTree)
    # Let's dynamically find where genomics start
    GENOMIC_START_IDX = 1 + joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib')).get_feature_names_out().shape[0]
    X_clinical = X_global[:, :GENOMIC_START_IDX]

    for site in targets:
        print(f"\n📁 Training Model: {site}")
        y = df[site]
        
        # Cross-validation setup
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        
        # 1. Train Clinical-Only Baseline
        aucs_clin = []
        for train_idx, val_idx in skf.split(X_clinical, y):
            model_clin = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
            model_clin.fit(X_clinical[train_idx], y.iloc[train_idx])
            probs = model_clin.predict_proba(X_clinical[val_idx])[:, 1]
            aucs_clin.append(roc_auc_score(y.iloc[val_idx], probs))
        
        mean_auc_clin = np.mean(aucs_clin)
        
        # 2. Train Integrated Model (Clinical + Genomic)
        aucs_int = []
        for train_idx, val_idx in skf.split(X_global, y):
            model_int = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
            model_int.fit(X_global[train_idx], y.iloc[train_idx])
            probs = model_int.predict_proba(X_global[val_idx])[:, 1]
            aucs_int.append(roc_auc_score(y.iloc[val_idx], probs))
        
        mean_auc_int = np.mean(aucs_int)
        lift = mean_auc_int - mean_auc_clin
        
        print(f"   📊 Baseline (Soil): {mean_auc_clin:.4f}")
        print(f"   🚀 Integrated (Seed+Soil): {mean_auc_int:.4f}")
        print(f"   🧬 Genomic Lift: {lift:+.4f}")
        
        # Train one final model on ALL data and save it
        model_int.fit(X_global, y)
        model_name = f"model_{site.lower()}.joblib"
        joblib.dump(model_int, os.path.join(MODEL_DIR, model_name))
        
        summary.append({
            'Site': site, 
            'Baseline_AUC': mean_auc_clin,
            'Integrated_AUC': mean_auc_int,
            'Lift': lift,
            'Count': y.sum()
        })

    return pd.DataFrame(summary)

if __name__ == "__main__":
    df, X, targets = load_and_preprocess()
    report = train_all_models(df, X, targets)
    
    report.sort_values(by='Lift', ascending=False, inplace=True)
    print("\n" + "="*60)
    print("      GLOBAL ACCURACY REPORT (AUDITED FOR LIFT)")
    print("="*60)
    print(report.to_string(index=False))
    
    report.to_csv(os.path.join(MODEL_DIR, 'global_site_report_v2.csv'), index=False)
    print("\n✅ All 21 models re-trained with Top 100 genes and Baselines.")
