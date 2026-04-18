import pandas as pd
import numpy as np
import xgboost as xgb
import os
from sklearn.preprocessing import StandardScaler

# Paths
SEED_DATA = 'data/camelyon16_tiled_features.csv'
UNLABELED_DATA = 'data/camelyon16_features_full_cleaned.csv'
OUTPUT_CSV = 'data/camelyon16_pseudo_labeled.csv'

def pseudo_label():
    print("Loading high-fidelity seed data (112 samples)...")
    df_seed = pd.read_csv(SEED_DATA)
    
    # Features start from v_feat_0
    feature_cols = [col for col in df_seed.columns if col.startswith('v_feat_')]
    
    X_seed = df_seed[feature_cols].values
    y_seed = df_seed['IS_TUMOR'].values
    
    print(f"Class distribution in seed: {pd.Series(y_seed).value_counts().to_dict()}")

    # 1. Train Seed Model
    print("Training Seed XGBoost model...")
    seed_model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    seed_model.fit(X_seed, y_seed)
    
    # 2. Ingest Unlabeled Data (89,217 samples)
    print(f"Ingesting unlabeled data from {UNLABELED_DATA}...")
    # Use chunking to be safe with memory
    chunk_size = 20000
    all_pseudo_labeled = []
    
    reader = pd.read_csv(UNLABELED_DATA, chunksize=chunk_size)
    
    total_processed = 0
    for chunk in reader:
        # Preprocess chunk (ensure same features)
        # Note: Unlabeled data also has IS_TUMOR column (which is likely garbage indices like 99, 98...)
        # We will OVERWRITE it with our predictions.
        
        X_unlabeled = chunk[feature_cols].values
        
        # 3. Predict Pseudo-Labels
        # We can use predict_proba to only keep highly confident labels if we want
        probs = seed_model.predict_proba(X_unlabeled)[:, 1]
        
        # Simple thresholding for now
        # If prob > 0.8 -> Tumor(1), if prob < 0.2 -> Healthy(0)
        # If middle, we could either discard or use the most likely class
        # For simplicity and maximum data volume, we'll take the argmax for now
        preds = (probs > 0.5).astype(int)
        
        chunk['IS_TUMOR'] = preds
        chunk['PSEUDO_CONFIDENCE'] = probs
        
        all_pseudo_labeled.append(chunk)
        total_processed += len(chunk)
        print(f"  - Pseudo-labeled {total_processed} samples...")

    print("Merging labeled dataset...")
    df_final = pd.concat(all_pseudo_labeled)
    
    print(f"Pseudo-label distribution: {df_final['IS_TUMOR'].value_counts().to_dict()}")
    
    # 4. Save Final Dataset
    print(f"Saving to {OUTPUT_CSV}...")
    df_final.to_csv(OUTPUT_CSV, index=False)
    print("✨ Pseudo-labeling complete.")

if __name__ == "__main__":
    pseudo_label()
