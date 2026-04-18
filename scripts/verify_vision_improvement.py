import joblib
import os
import numpy as np
import sys
# Fix import to find VisionEncoder
sys.path.append(os.path.join(os.path.dirname(__file__)))
from extract_embeddings import VisionEncoder

# Paths
MODEL_DIR = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models'
NEW_MODEL = os.path.join(MODEL_DIR, 'vision_detector.joblib')
OLD_MODEL = os.path.join(MODEL_DIR, 'vision_detector_old_v1.joblib')

TEST_SLIDES = [
    ('data/scary_tumor.png', 'Tumor'),
    ('data/positive_tumor.png', 'Tumor'),
    ('data/healthy_slide.png', 'Healthy'),
    ('data/test_slide.png', 'Healthy')
]

def verify():
    print("Loading Vision Encoder...")
    encoder = VisionEncoder()
    
    print(f"Loading Models...")
    model_new = joblib.load(NEW_MODEL)
    model_old = joblib.load(OLD_MODEL) if os.path.exists(OLD_MODEL) else None
    
    print("-" * 60)
    print(f"{'Slide Path':<30} | {'Truth':<8} | {'Old Prob':<8} | {'New Prob':<8}")
    print("-" * 60)
    
    for slide, truth in TEST_SLIDES:
        if not os.path.exists(slide):
            continue
            
        emb = encoder.get_embeddings(slide)
        
        prob_new = model_new.predict_proba(emb)[0, 1]
        prob_old = model_old.predict_proba(emb)[0, 1] if model_old else 0.0
        
        print(f"{os.path.basename(slide):<30} | {truth:<8} | {prob_old:8.2%} | {prob_new:8.2%}")

    print("-" * 60)
    print("Verification complete.")

if __name__ == "__main__":
    verify()
