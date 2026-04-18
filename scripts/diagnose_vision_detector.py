import pandas as pd
import numpy as np
import joblib
import os

def diagnose():
    print("--- VISION DETECTOR DIAGNOSTIC ---")
    model_path = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models\vision_detector.joblib'
    detector = joblib.load(model_path)
    
    # 1. Load the Scary Slide Vector
    pos_data = pd.read_csv('data/positive_embedding.csv')
    X_pos = pos_data.values
    
    # 2. Get Probability
    prob = detector.predict_proba(X_pos)[0]
    print(f"Scary Slide Probabilities: [Normal: {prob[0]:.4f}, Tumor: {prob[1]:.4f}]")
    
    # 3. Check Library Distribution
    lib = pd.read_csv('data/camelyon16_features_v2.csv')
    print(f"Library Size: {len(lib)}")
    print(f"Tumor Samples: {len(lib[lib['IS_TUMOR']==1])}")
    
    # Check if scary slide is in library
    res = detector.predict_proba(lib[[f'v_feat_{i}' for i in range(768)]].values)
    print(f"Average Tumor Confidence in Library: {res[lib['IS_TUMOR']==1, 1].mean():.4f}")

if __name__ == "__main__":
    diagnose()
