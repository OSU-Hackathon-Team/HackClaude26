import requests
import base64
import os

def verify_liver_tropism():
    url = "http://127.0.0.1:8000/simulate"
    
    # Load the high-impact tumor slide
    img_path = "data/scary_tumor.png"
    img_b64 = None
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            img_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')

    # scenario: High-Risk Metastatic Colon Cancer
    profile = {
        "name": "Patient C - Advanced Colon-Liver Tropism",
        "age": 62,
        "sex": "Male",
        "primary_site": "Colon",
        "oncotree_code": "COAD",
        "mutations": {
            "APC": 1, 
            "KRAS": 1, 
            "TP53": 1,
            "SMAD4": 1,
            "BRAF": 1
        }
    }

    print("--- VERIFYING MULTIMODAL COLON-LIVER METASTASES ---")
    payload = {
        "profile": profile, 
        "image": img_b64,
        "doctor_id": "dr_clerk_test_003"
    }

    try:
        response = requests.post(url, json=payload)
        r = response.json()
        print(f"\nRAW RESPONSE: {r}")
        
        risks = r.get('simulated_risks', {})
        liver_risk = risks.get('DMETS_DX_LIVER', 0)
        lung_risk = risks.get('DMETS_DX_LUNG', 0)
        peritoneum_risk = risks.get('DMETS_DX_PERITONEUM', 0)
        
        print(f"\nResults for {profile['name']}:")
        print(f"   -> Liver Metastatic Risk: {liver_risk*100:.2f}%")
        print(f"   -> Lung Metastatic Risk: {lung_risk*100:.2f}%")
        print(f"   -> Peritoneum Risk: {peritoneum_risk*100:.2f}%")
        
    except Exception as e:
        print(f"Error during verification: {e}")

if __name__ == "__main__":
    verify_liver_tropism()
