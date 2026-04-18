import requests
import base64
import os
import pandas as pd

def run_stress_test():
    url = "http://127.0.0.1:8000/simulate"
    
    # Standard Patient Profile (High-Risk Colon Cancer)
    profile = {
        "age": 62,
        "sex": "Female",
        "primary_site": "COLON",
        "oncotree_code": "COAD",
        "mutations": {"APC": 1, "KRAS": 1, "TP53": 1}
    }

    scenarios = [
        {"name": "A: Genomic Only (No Image)", "image": None},
        {"name": "B: The Red Flag (Tumor Slide)", "image": "data/scary_tumor.png"},
        {"name": "C: The Clean Bill (Healthy Slide)", "image": "data/healthy_slide.png"}
    ]

    results = []
    
    print("--- MULTIMODAL STRESS TEST ---")
    
    for scen in scenarios:
        img_b64 = None
        if scen["image"]:
            if os.path.exists(scen["image"]):
                with open(scen["image"], "rb") as f:
                    img_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
            else:
                print(f"Warning: {scen['image']} not found. Skipping image logic.")

        payload = {"profile": profile, "image": img_b64}
        try:
            r = requests.post(url, json=payload).json()
            liver_risk = r['simulated_risks'].get('DMETS_DX_LIVER', 0)
            bone_risk = r['simulated_risks'].get('DMETS_DX_BONE', 0)
            lift = r.get('visual_lift', 0.0)
            conf = r.get('vision_confidence', 0.5)
            
            results.append({
                "Scenario": scen["name"],
                "Vision Conf": f"{conf*100:.1f}%",
                "Liver Risk": f"{liver_risk*100:.1f}%",
                "Bone Risk": f"{bone_risk*100:.1f}%",
                "Visual Lift": f"{lift*100:+.1f}%"
            })
        except Exception as e:
            print(f"Error calling API for {scen['name']}: {e}")

    df = pd.DataFrame(results)
    print("\n" + "="*80)
    print("           MULTIMODAL HEATMAP: IMAGE-DRIVEN DECISION AUDIT")
    print("="*80)
    print(df.to_string(index=False))
    print("="*80)

if __name__ == "__main__":
    run_stress_test()
