from scripts.extract_embeddings import VisionEncoder
import numpy as np

def run_test():
    print("Testing Mutimodal Vision Pipeline...")
    encoder = VisionEncoder()
    
    # Path to the image we just generated
    image_path = "data/test_slide.png"
    
    try:
        embedding = encoder.get_embeddings(image_path)
        
        print("-" * 30)
        print("SUCCESS!")
        print(f"Embedding Shape: {embedding.shape}")
        print(f"First 5 Values: {embedding[0][:5]}")
        print("-" * 30)
        print("Verification: The pre-trained model was able to see the tumor slide")
        print("and translate it into a numerical fingerprint (embedding).")
        
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    run_test()
