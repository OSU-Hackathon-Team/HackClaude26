"""
================================================================================
FILE: merge_multiomic.py
ROLE: Data Integrator (Multi-Omic Bridge)
PURPOSE: This script creates the "Full Picture" dataset. It fuses our clinical 
         "Soil" data (Age, Site) with our new genomic "Seed" data (Mutations).
         
LEARNING POINTS:
- INNER JOIN: We only keep patients who have BOTH clinical and genomic data. 
  In the real world, not every patient gets sequenced, so our dataset 
  naturally "shrinks" to the high-quality, fully-characterized samples.
- FEATURE SPACE: Notice how the column count increases. We are giving the 
  AI a "higher dimension" view of each patient.
================================================================================
"""

import pandas as pd
import os

# Configuration
CLINICAL_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_clean.tsv'
MUTATION_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\mutation_matrix.tsv'
OUTPUT_PATH = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'

def merge_datasets():
    print("🚀 Loading clinical and mutation datasets...")
    
    try:
        # Load the Clinical Baseline (25k+ records)
        df_clinical = pd.read_csv(CLINICAL_PATH, sep='\t')
        print(f"✅ Clinical Data: {df_clinical.shape[0]} patients.")
        
        # Load the Mutation Matrix (18k+ records)
        df_mutations = pd.read_csv(MUTATION_PATH, sep='\t')
        print(f"✅ Mutation Matrix: {df_mutations.shape[0]} sequenced samples.")
        
        # Perform the Merge
        # We merge on SAMPLE_ID because mutations are linked to the specific tumor sample.
        print("🔗 Performing Inner Join on SAMPLE_ID...")
        df_multi = pd.merge(df_clinical, df_mutations, on='SAMPLE_ID', how='inner')
        
        # Status Check
        print(f"✨ MULTI-OMIC MERGE SUCCESSFUL ✨")
        print(f"Final Dataset: {df_multi.shape[0]} patients, {df_multi.shape[1]} features.")
        
        # Save the master file for Iteration Two training
        df_multi.to_csv(OUTPUT_PATH, sep='\t', index=False)
        print(f"📁 Master dataset saved to: {OUTPUT_PATH}")

    except Exception as e:
        print(f"❌ Error during merge: {e}")

if __name__ == "__main__":
    merge_datasets()
