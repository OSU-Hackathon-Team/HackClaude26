import requests
import base64
import json
import os

def test_multimodal_api():
    print("TESTING MULTIMODAL API...")
    
    # 1. Prepare Base64 Image
    image_path = "data/test_slide.png"
    with open(image_path, "rb") as f:
        img_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
    
    # 2. Mock Request
    payload = {
        "profile": {
            "age": 55,
            "sex": "Female",
            "primary_site": "BREAST",
            "oncotree_code": "BRCA",
            "mutations": {"TP53": 1, "PIK3CA": 1}
        },
        "image": img_b64
    }
    
    # 3. Call Simulation Endpoint
    url = "http://127.0.0.1:8000/simulate"
    try:
        print("Sending Multimodal Request to API...")
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(f"Visual Lift Observed: {result['visual_lift']:+.4f}")
            print(f"Has Visual Data: {result['has_visual_data']}")
            
            # Show Top 3 Risks
            risks = result['simulated_risks']
            sorted_risks = sorted(risks.items(), key=lambda x: x[1], reverse=True)[:3]
            print("\nTop Heatmap Risks:")
            for site, prob in sorted_risks:
                print(f"   -> {site}: {prob*100:.1f}%")
        else:
            print(f"❌ FAILED: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_multimodal_api()
