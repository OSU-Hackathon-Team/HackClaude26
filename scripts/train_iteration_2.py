"""
================================================================================
FILE: train_iteration_2.py
ROLE: The "Seeds & Soil" Learning Engine
PURPOSE: This script trains our most advanced model yet. It uses both 
         clinical metadata (Soil) and mutation status (Seeds) to predict
         metastatic risk for Liver, Lung, Bone, Brain, and Adrenal.
         
LEARNING POINTS:
- GENOMIC LIFT: We are looking for an increase in AUC compared to Iteration 1.
- FEATURE DENSITY: We've added 8 new binary mutation columns (TP53, KRAS, etc).
- INTERPRETABILITY: In Phase 2, we want to know *which* gene drives *which* organ risk.
================================================================================
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, brier_score_loss
import joblib
import os

# Configuration
# Note: We now use the MULTIOMIC dataset!
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'

TARGET_SITES = [
    'DMETS_DX_LIVER', 
    'DMETS_DX_LUNG', 
    'DMETS_DX_BONE', 
    'DMETS_DX_CNS_BRAIN', 
    'DMETS_DX_ADRENAL_GLAND'
]

# Clinical "Soil" features
CLINICAL_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

# Genomic "Seed" features (extracted in Step 1)
GENOMIC_COLS = ['TP53', 'KRAS', 'PIK3CA', 'EGFR', 'APC', 'PTEN', 'AR', 'BRAF']

def load_and_preprocess():
    print(f"🚀 Loading multi-omic data from {os.path.basename(DATA_PATH)}...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # Target Transformation
    for col in TARGET_SITES:
        df[col] = df[col].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # Imputation (Median by cancer type)
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    X_clinical_raw = df[CLINICAL_COLS]
    
    # Intern: EMERGENCY LEAKAGE PURGE.
    # We found clinical columns that 'look into the future' (Age at Death, OS_MONTHS).
    # We must exclude EVERYTHING except our core "Soil" and "Seeds".
    dmet_cols = [c for c in df.columns if 'DMETS_DX' in c]
    leakage_cols = [
        'AGE_AT_DEATH', 'AGE_AT_EVIDENCE_OF_METS', 'AGE_AT_LAST_CONTACT', 
        'AGE_AT_SURGERY', 'OS_STATUS', 'OS_MONTHS', 'METASTATIC_SITE', 
        'MET_COUNT', 'MET_SITE_COUNT', 'IS_DIST_MET_MAPPED', 'OS_STATUS'
    ]
    other_metadata = ['SAMPLE_ID', 'PATIENT_ID', 'ORGAN_SYSTEM', 'SUBTYPE', 'SAMPLE_TYPE', 'PRIMARY_SITE_GROUPS', 'CANCER_TYPE', 'CANCER_TYPE_DETAILED', 'MSI_SCORE', 'MSI_TYPE', 'TMB_NONSYNONYMOUS', 'TUMOR_PURITY', 'GENE_PANEL', 'SAMPLE_COVERAGE', 'RACE']
    
    excluded = CLINICAL_COLS + TARGET_SITES + dmet_cols + leakage_cols + other_metadata
    
    # Genomics are columns not in the excluded list and are numeric (mutations)
    GENOMIC_COLS = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    X_genomic = df[GENOMIC_COLS].values 
    Y = df[TARGET_SITES]
    
    # Preprocessing Clinical features
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(X_clinical_raw[cat_cols])
    X_num = scaler.fit_transform(X_clinical_raw[num_cols])
    
    # Combine Clinical + Genomic into one Master Feature Set
    # Intern: This hstack is where the "Seeds" and "Soil" actually meet.
    X = np.hstack([X_num, X_cat, X_genomic])
    
    print(f"✅ Data ready. Total features: {X.shape[1]} ({len(GENOMIC_COLS)} genomic).")
    return X, Y

def train_iteration_2(X, Y):
    print("\n--- Phase 2 Cross-Validation ---")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {site: [] for site in TARGET_SITES}
    
    for site in TARGET_SITES:
        print(f"\nAnalyzing: {site}")
        y_site = Y[site]
        
        # Guard against rare targets
        if y_site.sum() < 10:
            print(f"⚠️ Skipping {site} (Rare).")
            continue
            
        fold = 1
        for train_idx, val_idx in skf.split(X, y_site):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y_site.iloc[train_idx], y_site.iloc[val_idx]
            
            # XGBoost configured without the deprecated warning-triggering parameter
            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                eval_metric='logloss',
                random_state=42,
                scale_pos_weight=(len(y_train) - y_train.sum()) / y_train.sum()
            )
            
            model.fit(X_train, y_train)
            probs = model.predict_proba(X_val)[:, 1]
            
            auc = roc_auc_score(y_val, probs)
            brier = brier_score_loss(y_val, probs)
            results[site].append({'auc': auc, 'brier': brier})
            
            print(f"  Fold {fold}: AUC={auc:.4f}")
            fold += 1
            
        avg_auc = np.mean([r['auc'] for r in results[site]])
        print(f"✨ Mean Phase 2 AUC for {site}: {avg_auc:.4f}")

    return results

if __name__ == "__main__":
    X, Y = load_and_preprocess()
    train_iteration_2(X, Y)
    print("\n✅ Phase 2 Model Training Complete.")
