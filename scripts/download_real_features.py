"""
================================================================================
FILE: download_real_features.py
ROLE: The Real-World Data Seeder
PURPOSE: This script pulls the pre-extracted Phikon features for the 
         CAMELYON16 dataset from Hugging Face.
         
IT TURNS 3TB OF IMAGES INTO A 100MB CSV.
================================================================================
"""

from datasets import load_dataset
import pandas as pd
import os

def download_and_save():
    print("Connecting to Hugging Face to fetch a subset of CAMELYON16 features...")
    
    # Correct way to get a subset in HF datasets
    ds = load_dataset("owkin/camelyon16-features", split="Phikon_train[:100]")
    
    # Convert to Pandas
    df = ds.to_pandas()
    
    print(f"Downloaded {len(df)} real fingerprints. Formatting...")
    
    # Extract the vectors into a matrix
    features = pd.DataFrame(df['features'].tolist())
    features.columns = [f'v_feat_{i}' for i in range(features.shape[1])]
    
    # Add synthetic IDs and labels
    features['PATIENT_ID'] = [f'REAL_SLIDE_{i:03d}' for i in range(len(features))]
    features['IS_TUMOR'] = df['label'].values
    
    # Reorder
    cols = ['PATIENT_ID', 'IS_TUMOR'] + [c for c in features.columns if c not in ['PATIENT_ID', 'IS_TUMOR']]
    features = features[cols]
    
    output_path = 'data/camelyon16_features.csv'
    print(f"Saving to {output_path}...")
    features.to_csv(output_path, index=False)
    print("Real-world library is now online (Subset)!")

if __name__ == "__main__":
    download_and_save()
