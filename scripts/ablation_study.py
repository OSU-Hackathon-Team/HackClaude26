"""
================================================================================
FILE: ablation_study.py
ROLE: The "Truth Seeker" Diagnostic
PURPOSE: This script deconstructs the 90%+ AUC score for Ovarian metastasis.
         It removes features one-by-one (Ablation) to show how much of the
         accuracy is due to "Clinical Shortcuts" (Sex/Primary Site) versus 
         "Genomic Truth."
         
LEARNING POINTS:
- FEATURE ABLATION: The best way to understand a model is to "break" it
  systematically. By removing Sex, we see exactly how much the model 
  relies on that one variable.
- BASELINE COMPARISON: It proves that 90% isn't "Magic"—it's mostly 
  the result of valid clinical constraints in the data.
================================================================================
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score
import os

# Configuration
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'
TARGET = 'DMETS_DX_OVARY'

def run_experiment():
    print(f"🚀 Loading data for Ovarian Ablation Study...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    df[TARGET] = df[TARGET].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # 1. PREPARE ALL GENOMIC COLS
    dmet_cols = [c for c in df.columns if 'DMETS_DX' in c]
    leakage_cols = ['AGE_AT_DEATH', 'AGE_AT_EVIDENCE_OF_METS', 'AGE_AT_LAST_CONTACT', 'AGE_AT_SURGERY', 'OS_STATUS', 'OS_MONTHS', 'METASTATIC_SITE', 'MET_COUNT', 'MET_SITE_COUNT', 'IS_DIST_MET_MAPPED']
    clinical_meta = ['SAMPLE_ID', 'PATIENT_ID', 'ORGAN_SYSTEM', 'SUBTYPE', 'SAMPLE_TYPE', 'PRIMARY_SITE_GROUPS', 'CANCER_TYPE', 'CANCER_TYPE_DETAILED', 'MSI_SCORE', 'MSI_TYPE', 'TMB_NONSYNONYMOUS', 'TUMOR_PURITY', 'GENE_PANEL', 'SAMPLE_COVERAGE', 'RACE']
    baseline_cols = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    
    excluded = dmet_cols + leakage_cols + clinical_meta + baseline_cols
    genomic_cols = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    # 2. DEFINE FEATURE SETS
    # Set A: FULL (Age, Sex, Primary, OncoTree, 100 Genes)
    # Set B: NO SHORTCUTS (Age, OncoTree, 100 Genes) -- REMOVING SEX/PRIMARY
    # Set C: GENES ONLY (100 Genes)
    
    def evaluate(features_to_use, name):
        X_raw = df[features_to_use]
        
        # Preprocessing
        cat_cols = [c for c in X_raw.columns if X_raw[c].dtype == object]
        num_cols = [c for c in X_raw.columns if X_raw[c].dtype != object]
        
        X_final = None
        if cat_cols:
            enc = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
            X_cat = enc.fit_transform(X_raw[cat_cols])
            X_final = X_cat
        if num_cols:
            scaler = StandardScaler()
            X_num = scaler.fit_transform(X_raw[num_cols])
            X_final = np.hstack([X_final, X_num]) if X_final is not None else X_num
            
        y = df[TARGET]
        skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        aucs = []
        for train_idx, val_idx in skf.split(X_final, y):
            model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
            model.fit(X_final[train_idx], y.iloc[train_idx])
            probs = model.predict_proba(X_final[val_idx])[:, 1]
            aucs.append(roc_auc_score(y.iloc[val_idx], probs))
        
        print(f"✅ {name}: {np.mean(aucs):.4f} AUC")
        return np.mean(aucs)

    print("\n--- ABLATION RESULTS ---")
    evaluate(baseline_cols + genomic_cols, "FULL INTEGRATED MODEL (with Sex/Primary)")
    evaluate(['AGE_AT_SEQUENCING', 'ONCOTREE_CODE'] + genomic_cols, "NO SHORTCUT MODEL (Removed Sex/Primary)")
    evaluate(genomic_cols, "GENOMICS ONLY (Pure DNA Signal)")

if __name__ == "__main__":
    run_experiment()
