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
from transformers import ViTImageProcessor, ViTModel
from PIL import Image
import os
import io
import base64
import numpy as np

class VisionEncoder:
    def __init__(self, model_name="owkin/phikon"):
        print(f"Initializing Vision Encoder: {model_name}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        
        # Load Preprocessor and Model
        self.processor = ViTImageProcessor.from_pretrained(model_name)
        self.model = ViTModel.from_pretrained(model_name, add_pooling_layer=False).to(self.device).eval()

    def get_embeddings_batch(self, images):
        """
        Supports a list of PIL Image objects.
        """
        inputs = self.processor(images=images, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
        return embeddings

    def get_embeddings(self, image_input):
        """
        Supports:
        - Absolute path (string)
        - Base64 string (beginning with 'data:image')
        - PIL Image object
        """
        if isinstance(image_input, str):
            if image_input.startswith("data:image"):
                # Handle Base64
                header, encoded = image_input.split(",", 1)
                image_data = base64.b64decode(encoded)
                image = Image.open(io.BytesIO(image_data)).convert("RGB")
            else:
                # Handle File Path
                if not os.path.exists(image_input):
                    raise FileNotFoundError(f"Image not found at {image_input}")
                image = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            image = image_input
        else:
            raise ValueError("Unsupported image input type.")

        # 1. Preprocess Image
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        # 2. Inference (No Gradient Tracking)
        with torch.no_grad():
            outputs = self.model(**inputs)
            
        # 3. Mean Pooling (Average across all patches to get patient-level feature)
        # Phikon output shape: [batch, num_patches, 768]
        embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
        
        return embeddings

if __name__ == "__main__":
    # Test path
    test_path = "data/test_slide.png"
    if os.path.exists(test_path):
        encoder = VisionEncoder()
        emb = encoder.get_embeddings(test_path)
        print(f"Success! Embedding Shape: {emb.shape}")
    print("Vision Encoder ready for Iteration 1.")
    print("Contract: Input = Image Path | Output = [1, 768] Vector")
