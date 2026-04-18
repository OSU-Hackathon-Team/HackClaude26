import pandas as pd
import os
import glob

# Check aligned seed data
seed_path = 'data/multimodal_alignment_seed.csv'
if os.path.exists(seed_path):
    df_seed = pd.read_csv(seed_path)
    print(f"Seed Data (Multimodal): {len(df_seed)} samples")
    vision_cols = [c for c in df_seed.columns if c.startswith('v_feat_')]
    print(f"Vision Features count: {len(vision_cols)}")
    print(f"Sample labels (DMETS_DX_LIVER):\n{df_seed['DMETS_DX_LIVER'].value_counts() if 'DMETS_DX_LIVER' in df_seed.columns else 'N/A'}")
else:
    print("No Seed Data found.")

# Check available images
image_dir = 'data'
images = glob.glob(os.path.join(image_dir, "*.png")) + glob.glob(os.path.join(image_dir, "*.jpg"))
print(f"Total available images in data/: {len(images)}")
for img in images[:5]:
    print(f"  - {os.path.basename(img)}")

# Vision detector analysis (if possible)
import joblib
detector_path = r'c:\Users\pohfe\OneDrive - The Ohio State University\Desktop\Coding Projects\CancerPrediction\models\vision_detector.joblib'
if os.path.exists(detector_path):
    detector = joblib.load(detector_path)
    print(f"\nVision Detector type: {type(detector)}")
    if hasattr(detector, 'coef_'):
        print(f"Detector has coefficients. Complexity: {detector.coef_.shape}")
else:
    print("\nVision Detector not found at " + detector_path)
