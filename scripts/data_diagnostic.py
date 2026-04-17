import pandas as pd
import numpy as np
import os

# Load clean data
DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data_clean.tsv'

try:
    df = pd.read_csv(DATA_PATH, sep='\t')
    print(f"✅ Dataset loaded successfully: {df.shape[0]} rows, {df.shape[1]} columns.\n")
except Exception as e:
    print(f"❌ Error loading data: {e}")
    exit()

# 1. Check for Missing Values in Primary Features (Using Verified Headers)
core_features = ['AGE_AT_SEQUENCING', 'SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']
print("--- Missing Values in Core Features ---")
for col in core_features:
    missing = df[col].isnull().sum()
    print(f"{col:<25}: {missing} missing ({missing/len(df)*100:.2f}%)")

# 2. Check for Target Variation (Metastatic Sites)
target_cols = [c for c in df.columns if 'DMETS_DX_' in c]
print("\n--- Positive Label Variation (Metastatic Presence) ---")
for col in target_cols[:5]: # Check first 5 for brevity
    pos_count = (df[col] == 1).sum()
    print(f"{col:<25}: {pos_count:>5} cases ({pos_count/len(df)*100:.2f}%)")

# 3. Check for Data Consistency
print("\n--- Data Consistency Checks ---")
unique_sex = df['SEX'].unique()
print(f"Unique values in 'SEX': {unique_sex}")

unique_sites = df['PRIMARY_SITE'].nunique()
print(f"Unique Primary Tumor Sites: {unique_sites}")

# Conclusion
print("\n--- Final Assessment ---")
missing_pct = df[core_features].isnull().sum().sum() / len(df)
if missing_pct < 0.1:
    print("🚀 ASSESSMENT: The data is in EXCELLENT condition for analysis.")
else:
    print("⚠️ ASSESSMENT: Some cleaning/imputation required for missing values.")
