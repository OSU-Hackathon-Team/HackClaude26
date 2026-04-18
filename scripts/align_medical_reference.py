import pandas as pd
import numpy as np
import os

def align_medical_twins():
    print("--- ALIGNING MEDICAL REFERENCE TWINS (SIGNAL BOOTSTRAP) ---")
    
    # 1. Load Data
    multiomic_path = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\data\data_multiomic.tsv'
    features_path = 'data/camelyon16_features_v2.csv'
    
    if not os.path.exists(multiomic_path) or not os.path.exists(features_path):
        print("Error: Required data files missing.")
        return

    df_gen = pd.read_csv(multiomic_path, sep='\t')
    df_feat = pd.read_csv(features_path)
    
    print(f"Loaded {len(df_gen)} genomic records and {len(df_feat)} medical slides.")

    # 2. Filter Candidates for Breast/Lymph context
    # CAMELYON16 is breast cancer lymph node metastases.
    candidates = df_gen[df_gen['PRIMARY_SITE'] == 'Breast'].copy()
    
    # Target Site for validation (Lymph nodes or distant metastasis indicator)
    # We use 'IS_DIST_MET_MAPPED' or similar as a proxy if explicit lymph isn't clear
    if 'DMETS_DX_LYMPH_NODE' in candidates.columns:
        met_target = 'DMETS_DX_LYMPH_NODE'
    else:
        met_target = 'IS_DIST_MET_MAPPED' # fallback

    # 3. Twin Matching Logic
    # We will pick 50 Metastatic patients for our 50 Tumor images
    # We will pick 50 Non-Metastatic patients for our 50 Normal images
    
    tumor_images = df_feat[df_feat['IS_TUMOR'] == 1].head(50)
    norm_images = df_feat[df_feat['IS_TUMOR'] == 0].head(50)
    
    pos_twins = candidates[candidates[met_target] == 'Yes'].head(50)
    neg_twins = candidates[candidates[met_target] == 'No'].head(50)

    # Combine
    paired_pos = pd.concat([
        pos_twins.reset_index(drop=True), 
        tumor_images.reset_index(drop=True).drop(columns=['PATIENT_ID'])
    ], axis=1)
    
    paired_neg = pd.concat([
        neg_twins.reset_index(drop=True), 
        norm_images.reset_index(drop=True).drop(columns=['PATIENT_ID'])
    ], axis=1)

    aligned_seed = pd.concat([paired_pos, paired_neg], ignore_index=True)
    
    # Save to a dedicated seed file
    seed_path = 'data/multimodal_alignment_seed.csv'
    aligned_seed.to_csv(seed_path, index=False)
    
    print(f"SUCCESS: Created {len(aligned_seed)} high-fidelity multimodal pairs.")
    print(f"Location: {seed_path}")

if __name__ == "__main__":
    align_medical_twins()
