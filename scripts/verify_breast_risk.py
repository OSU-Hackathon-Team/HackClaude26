import requests
import os
import pandas as pd

def verify_breast_risk():
    url = "http://127.0.0.1:8000/simulate"
    
    # scenario: High-Risk Metastatic Breast Cancer
    # Medical context: PIK3CA and TP53 mutations often correlate with aggressive metastatic potential in breast cancer.
    profile = {
        "name": "Patient B - Aligned Breast Risk",
        "age": 55,
        "sex": "Female",
        "primary_site": "Breast",
        "oncotree_code": "BRCA",
        "mutations": {
            "TP53": 1, 
            "PIK3CA": 1, 
            "GATA3": 1,
            "NOTCH1": 1
        }
    }

    print("--- VERIFYING CLINICAL RISK LOGGING ---")
    payload = {
        "profile": profile, 
        "image": None, # Genomic-only baseline test
        "doctor_id": "dr_clerk_test_002"
    }

    try:
        r = requests.post(url, json=payload).json()
        
        # We expect high Bone and Liver risk for this profile
        # Access the simulated_risks dictionary
        risks = r.get('simulated_risks', {})
        liver_risk = risks.get('DMETS_DX_LIVER', 0)
        bone_risk = risks.get('DMETS_DX_BONE', 0)
        lung_risk = risks.get('DMETS_DX_LUNG', 0)
        
        print(f"\nResults for {profile['name']}:")
        print(f"   -> Liver Metastatic Risk: {liver_risk*100:.2f}%")
        print(f"   -> Bone Metastatic Risk: {bone_risk*100:.2f}%")
        print(f"   -> Lung Metastatic Risk: {lung_risk*100:.2f}%")
        
        print("\n[VERIFICATION]")
        print("Check the API logs for 'Simulation logged for Patient B - Aligned Breast Risk'")
        
    except Exception as e:
        print(f"Error during verification: {e}")

if __name__ == "__main__":
    verify_breast_risk()
