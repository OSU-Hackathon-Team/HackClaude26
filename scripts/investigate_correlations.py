"""
================================================================================
FILE: investigate_correlations.py
ROLE: The "Bias Detector"
PURPOSE: Investigates why specific sites (Genitalia) have extremely high 
         accuracy (90%+ AUC). 
         
LEARNING POINTS:
- IMBALANCE & SHORTCUTS: If a target only appears in one Sex, the model 
  finds a "shortcut" that makes it look smarter than it is.
- BIOLOGICAL VS TECHNICAL: We need to see if the "Seeds" (Genetics) are 
  actually contributing, or if the "Soil" (Sex) is doing 100% of the work.
================================================================================
"""

import pandas as pd
import numpy as np

DATA_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'

def investigate():
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    high_auc_sites = ['DMETS_DX_FEMALE_GENITAL', 'DMETS_DX_MALE_GENITAL', 'DMETS_DX_OVARY']
    
    print("🔍 INVESTIGATING HIGH-AUC SITES CORRELATIONS\n")
    
    for site in high_auc_sites:
        print(f"=== Target: {site} ===")
        
        # 1. Correlation with SEX
        cross_sex = pd.crosstab(df['SEX'], df[site])
        print("--- Frequency by SEX ---")
        print(cross_sex)
        
        # 2. Correlation with PRIMARY_SITE
        pos_cases = df[df[site] == 'Yes']
        top_primaries = pos_cases['PRIMARY_SITE'].value_counts().head(5)
        print("\n--- Top Primary Sites for this Metastasis ---")
        print(top_primaries)
        
        # 3. Probability calculation
        total_female = (df['SEX'] == 'Female').sum()
        total_male = (df['SEX'] == 'Male').sum()
        pos_in_sex = (pos_cases['SEX'] == ('Female' if 'FEMALE' in site or 'OVARY' in site else 'Male')).sum()
        
        print(f"\n💡 Interpretation: {pos_in_sex} out of {len(pos_cases)} cases follow the expected Sex biological constraint.")
        print("-" * 30 + "\n")

if __name__ == "__main__":
    investigate()
