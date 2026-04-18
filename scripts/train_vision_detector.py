import pandas as pd
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import os

def train_vision_validator():
    print("--- TRAINING VISION VALIDATOR (ENSEMBLE LEVEL 2) ---")
    
    # 1. Load the 100 Real Medical Samples
    data_path = 'data/camelyon16_features_v2.csv'
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Run download_real_features.py first.")
        return
        
    df = pd.read_csv(data_path)
    
    # Extract features (v_feat_0 to v_feat_767)
    X = df[[f'v_feat_{i}' for i in range(768)]].values
    y = df['IS_TUMOR'].values
    
    # 2. Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 3. Train the "Eyes"
    # We use LogisticRegression with proba output
    print("Training binary metastatic detector on Phikon embeddings...")
    detector = LogisticRegression(class_weight='balanced')
    detector.fit(X_train, y_train)
    
    score = detector.score(X_test, y_test)
    print(f"Validation Accuracy: {score*100:.1f}%")
    
    # 4. Save Model
    model_path = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models\vision_detector.joblib'
    joblib.dump(detector, model_path)
    print(f"Vision Monitor saved to {model_path}")

if __name__ == "__main__":
    train_vision_validator()
