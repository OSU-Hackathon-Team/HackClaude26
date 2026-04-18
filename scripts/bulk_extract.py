"""
================================================================================
FILE: bulk_extract.py
ROLE: The Batch Processor
PURPOSE: This script iterates over a folder of images, extracts their Phikon
         embeddings, and saves them to a CSV file. This CSV serves as the 
         bridge between our Image AI and our XGBoost AI.
         
LEARNING POINTS:
- BULK INFERENCE: Running AI on one image is easy; running it on thousands 
  requires efficient looping and data management.
- FEATURE MATRICES: We are creating a "Feature Matrix" where each row is a 
  patient and each column is a visual characteristic.
================================================================================
"""

import os
import pandas as pd
import numpy as np
from scripts.extract_embeddings import VisionEncoder

def run_bulk_extraction(input_dir="data/slides", output_csv="data/image_embeddings.csv"):
    print(f"Scanning directory: {input_dir}")
    
    # 1. Initialize Encoder
    encoder = VisionEncoder()
    
    # 2. Find all images
    valid_extensions = (".png", ".jpg", ".jpeg", ".tif")
    image_files = [f for f in os.listdir(input_dir) if f.lower().endswith(valid_extensions)]
    
    if not image_files:
        print("No images found in directory.")
        return

    print(f"Found {len(image_files)} images. Starting extraction...")

    results = []
    
    for i, filename in enumerate(image_files):
        patient_id = os.path.splitext(filename)[0] # e.g., SLIDE_001
        image_path = os.path.join(input_dir, filename)
        
        print(f"[{i+1}/{len(image_files)}] Processing {patient_id}...")
        
        try:
            # Extract 768-D vector
            vector = encoder.get_embeddings(image_path)
            
            # Flatten and create a row
            row = {"PATIENT_ID": patient_id}
            for j, val in enumerate(vector.flatten()):
                row[f"v_feat_{j}"] = val
            
            results.append(row)
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

    # 3. Save to CSV
    print(f"Saving {len(results)} records to {output_csv}...")
    df = pd.DataFrame(results)
    df.to_csv(output_csv, index=False)
    print("Bulk extraction complete.")

if __name__ == "__main__":
    run_bulk_extraction()
