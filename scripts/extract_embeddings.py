"""
================================================================================
FILE: extract_embeddings.py
ROLE: The "Vision Encoder"
PURPOSE: This script loads a pre-trained Pathology Foundation Model (Phikon) 
         and uses it to turn tumor images into numerical "fingerprints" 
         (embeddings). These fingerprints are then used by XGBoost.
         
LEARNING POINTS:
- FOUNDATION MODELS: We use 'Phikon', a model already trained on millions of 
  medical slides, so we don't have to train our own from scratch.
- EMBEDDINGS: AI doesn't see images; it sees vectors. This script converts 
  pixels into a 768-dimensional list of features.
- TRANSFER LEARNING: We are "transferring" the visual knowledge from Phikon 
  to our specific metastatic risk problem.
================================================================================
"""

import torch
from PIL import Image
from transformers import ViTImageProcessor, ViTModel
import numpy as np
import os

class VisionEncoder:
    def __init__(self, model_name="owkin/phikon"):
        print(f"Initializing Vision Encoder: {model_name}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        
        # Load Preprocessor and Model
        self.processor = ViTImageProcessor.from_pretrained(model_name)
        self.model = ViTModel.from_pretrained(model_name, add_pooling_layer=False)
        self.model.to(self.device)
        self.model.eval()

    def get_embeddings(self, image_path: str):
        """
        Takes an image path and returns a 768-dimensional embedding vector.
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")

        # 1. Load and Preprocess Image
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        # 2. Inference (No Gradient Tracking)
        with torch.no_grad():
            outputs = self.model(**inputs)
            
        # 3. Mean Pooling (Average across all patches to get patient-level feature)
        # Phikon output shape: [batch, num_patches, 768]
        last_hidden_state = outputs.last_hidden_state
        embeddings = torch.mean(last_hidden_state, dim=1)
        
        return embeddings.cpu().numpy()

if __name__ == "__main__":
    # Test script with a dummy image if exists, else print status
    encoder = VisionEncoder()
    print("Vision Encoder ready for Iteration 1.")
    print("Contract: Input = Image Path | Output = [1, 768] Vector")
