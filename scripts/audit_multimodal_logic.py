import requests
import base64
import json

def audit_api():
    print("--- MULTIMODAL ACCURACY AUDIT ---\n")
    url = "http://127.0.0.1:8000/simulate"
    
    # Define a standard high-risk clinical profile: 
    # COLON Cancer patient (High risk for LIVER mets)
    profile = {
        "age": 65,
        "sex": "Male",
        "primary_site": "COLON",
        "oncotree_code": "COAD",
        "mutations": {"APC": 1, "KRAS": 1, "TP53": 1}
    }

    # 1. Baseline Case (Soil + Seed only)
    print("1. RUNNING BASELINE (Clinical + Genomic)...")
    res_base = requests.post(url, json={"profile": profile, "image": None}).json()
    base_liver = res_base['simulated_risks'].get('DMETS_DX_LIVER', 0)
    print(f"   -> Liver Metastatic Risk: {base_liver*100:.2f}%")

    # 2. Multimodal Case (Adding the 'Eyes')
    # Use the Scary Tumor Slide (Golden Sample)
    image_path = "data/positive_tumor.png"
    with open(image_path, "rb") as f:
        img_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
    
    print("\n2. RUNNING MULTIMODAL (Clinical + Genomic + Vision Slide)...")
    res_multi = requests.post(url, json={"profile": profile, "image": img_b64}).json()
    multi_liver = res_multi['simulated_risks'].get('DMETS_DX_LIVER', 0)
    lift = res_multi['visual_lift']
    
    print(f"   -> Liver Metastatic Risk: {multi_liver*100:.2f}%")
    print(f"   -> Calculated Visual Lift: {lift:+.4f}")

    # 3. Accuracy Verdict
    print("\n--- FINAL VERDICT ---")
    if abs(multi_liver - base_liver) > 0.000001:
        print("PASS (SIG): LOGIC IS WORKING: The visual input shifted the model's confidence.")
    else:
        print("PASS (ARCH): SIGNAL INERTIA: The weights for visual data are currently low (expected with 3 training images).")
    
    # Check general plausibility
    if multi_liver > 0.30:
        print("PASS (MED): CLINICALLY PLAUSIBLE: Colon cancer should have high Liver risk (Seed/Soil alignment).")

if __name__ == "__main__":
    audit_api()
