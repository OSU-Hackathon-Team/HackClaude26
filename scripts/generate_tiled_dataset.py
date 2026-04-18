import os
import pandas as pd
import numpy as np
from PIL import Image
import torch
import sys
# Ensure we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from extract_embeddings import VisionEncoder

# Configuration
TILE_SIZE = 224
STRIDE = 32
BATCH_SIZE = 32
OUTPUT_CSV = 'data/camelyon16_tiled_features.csv'
SLIDES_TO_PROCESS = [
    ('data/positive_tumor.png', 1),
    ('data/scary_tumor.png', 1),
    ('data/healthy_slide.png', 0),
    ('data/test_slide.png', 0),
    ('data/slides/SLIDE_001.png', 1),
    ('data/slides/SLIDE_002.png', 1),
    ('data/slides/SLIDE_003.png', 0)
]

def generate_tiled_dataset():
    encoder = VisionEncoder()
    all_rows = []
    
    print(f"Starting Tiling & Embedding Extraction for {len(SLIDES_TO_PROCESS)} slides...")
    
    for slide_path, label in SLIDES_TO_PROCESS:
        if not os.path.exists(slide_path):
            print(f"Warning: Slide not found at {slide_path}, skipping.")
            continue
            
        print(f"Processing {slide_path} (Label: {label})...")
        img = Image.open(slide_path).convert('RGB')
        width, height = img.size
        
        # Slicing into tiles
        tile_buffer = []
        patient_ids = []
        tile_count = 0
        
        for y in range(0, height - TILE_SIZE, STRIDE):
            for x in range(0, width - TILE_SIZE, STRIDE):
                # Extract tile
                tile = img.crop((x, y, x + TILE_SIZE, y + TILE_SIZE))
                
                # Check if tile is mostly background (white/black) to save cycles
                extrema = tile.convert("L").getextrema()
                if extrema[1] - extrema[0] < 20: 
                    continue
                
                tile_buffer.append(tile)
                patient_ids.append(f"{os.path.basename(slide_path)}_{tile_count}")
                tile_count += 1
                
                if len(tile_buffer) >= BATCH_SIZE:
                    embs = encoder.get_embeddings_batch(tile_buffer)
                    for i, emb in enumerate(embs):
                        row = {'PATIENT_ID': patient_ids[i], 'IS_TUMOR': label}
                        for feat_idx in range(768):
                            row[f'v_feat_{feat_idx}'] = emb[feat_idx]
                        all_rows.append(row)
                    tile_buffer = []
                    patient_ids = []
                    if len(all_rows) % 128 == 0:
                        print(f"  - Extracted {len(all_rows)} total tiles so far...")

        # Process remaining buffer
        if tile_buffer:
            embs = encoder.get_embeddings_batch(tile_buffer)
            for i, emb in enumerate(embs):
                row = {'PATIENT_ID': patient_ids[i], 'IS_TUMOR': label}
                for feat_idx in range(768):
                    row[f'v_feat_{feat_idx}'] = emb[feat_idx]
                all_rows.append(row)
        
        print(f"Finished {slide_path}. Slide tiles: {tile_count}")

    print(f"Saving {len(all_rows)} samples to {OUTPUT_CSV}...")
    df = pd.DataFrame(all_rows)
    df.to_csv(OUTPUT_CSV, index=False)
    print("Dataset generation complete.")

if __name__ == "__main__":
    generate_tiled_dataset()
