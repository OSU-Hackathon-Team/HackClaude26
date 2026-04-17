"""
================================================================================
FILE: analyze_shap.py
ROLE: The "X-Ray" Diagnostic Tool
PURPOSE: This script uses SHAP (Shapley Additive Explanations) to peer into the 
         Integrated Model's brain. It tells us exactly which genes are driving 
         the prediction for Lung and Brain metastasis.
         
LEARNING POINTS:
- SHAP VALUES: They measure the "contribution" of each feature. A high SHAP
  value means that specific mutation pushed the risk score significantly.
- INTERACTION: Even if a gene doesn't move the *average* AUC, SHAP can show 
  if it's a powerful predictor for a specific group of patients.
================================================================================
"""

import pandas as pd
import numpy as np
import xgboost as xgb
import shap
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import os

# Configuration
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'
TARGET_SITE = 'DMETS_DX_LUNG' # Focus on the one with the biggest lift

CLINICAL_COLS = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']

def analyze():
    print(f"🚀 Loading multi-omic data for {TARGET_SITE} SHAP analysis...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # Target Transformation
    df[TARGET_SITE] = df[TARGET_SITE].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
    
    # Preprocessing (Exact same as training script)
    df['AGE_AT_SEQUENCING'] = df.groupby('ONCOTREE_CODE')['AGE_AT_SEQUENCING'].transform(lambda x: x.fillna(x.median()))
    df['SEX'] = df['SEX'].fillna(df['SEX'].mode()[0])
    df['PRIMARY_SITE'] = df['PRIMARY_SITE'].fillna('Unknown')
    
    # Feature Selection (Leakage Purge logic)
    dmet_cols = [c for c in df.columns if 'DMETS_DX' in c]
    leakage_cols = ['AGE_AT_DEATH', 'AGE_AT_EVIDENCE_OF_METS', 'AGE_AT_LAST_CONTACT', 'AGE_AT_SURGERY', 'OS_STATUS', 'OS_MONTHS', 'METASTATIC_SITE', 'MET_COUNT', 'MET_SITE_COUNT', 'IS_DIST_MET_MAPPED']
    other_metadata = ['SAMPLE_ID', 'PATIENT_ID', 'ORGAN_SYSTEM', 'SUBTYPE', 'SAMPLE_TYPE', 'PRIMARY_SITE_GROUPS', 'CANCER_TYPE', 'CANCER_TYPE_DETAILED', 'MSI_SCORE', 'MSI_TYPE', 'TMB_NONSYNONYMOUS', 'TUMOR_PURITY', 'GENE_PANEL', 'SAMPLE_COVERAGE', 'RACE']
    excluded = CLINICAL_COLS + dmet_cols + leakage_cols + other_metadata
    
    genomic_cols = [c for c in df.columns if c not in excluded and df[c].dtype in [np.int64, np.int32, np.float64, np.float32]]
    
    # Prepare X
    cat_cols = ['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
    num_cols = ['AGE_AT_SEQUENCING']
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    scaler = StandardScaler()
    
    X_cat = encoder.fit_transform(df[cat_cols])
    X_num = scaler.fit_transform(df[num_cols])
    X_genomic = df[genomic_cols].values
    
    X = np.hstack([X_num, X_cat, X_genomic])
    
    # Get feature names for interpretability
    feature_names = num_cols + list(encoder.get_feature_names_out(cat_cols)) + genomic_cols
    
    # Train one final model on all data
    print(f"🧠 Training model on all {len(df)} samples...")
    model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, eval_metric='logloss')
    model.fit(X, df[TARGET_SITE])
    
    print("📈 Calculating SHAP values (This may take a moment)...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    
    # Summarize top features
    print(f"\n✨ TOP DRIVERS FOR {TARGET_SITE} METASTASIS ✨")
    # SHAP values for binary classification are typically a list or 2D array
    # depending on the SHAP version and model. For XGBClassifier, it's often the probs.
    # We take the mean absolute SHAP value for each feature.
    vals = np.abs(shap_values).mean(0)
    feature_importance = pd.DataFrame(list(zip(feature_names, vals)), columns=['feature', 'importance_score'])
    feature_importance.sort_values(by=['importance_score'], ascending=False, inplace=True)
    
    # Print the Top 20 (including identifying the genomic superstars)
    print(feature_importance.head(20).to_string(index=False))
    
    # Filter for just genomic superstars
    print(f"\n🧬 TOP GENOMIC SEED DRIVERS FOR {TARGET_SITE}:")
    genomic_only = feature_importance[feature_importance['feature'].isin(genomic_cols)].head(10)
    print(genomic_only.to_string(index=False))

if __name__ == "__main__":
    analyze()
