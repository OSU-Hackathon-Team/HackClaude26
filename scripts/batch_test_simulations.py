import requests
import base64
import os
import json

def get_img_b64(path):
    if os.path.exists(path):
        with open(path, "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
    return None

SCENARIOS = [
    {
        "name": "Colon High-Risk (KRAS/BRAF) - No Image",
        "profile": {"age": 62, "sex": "Male", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {"KRAS": 1, "BRAF": 1}},
        "image_path": None
    },
    {
        "name": "Colon High-Risk (KRAS/BRAF) - Tumor Signal",
        "profile": {"age": 62, "sex": "Male", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {"KRAS": 1, "BRAF": 1}},
        "image_path": "data/scary_tumor.png"
    },
    {
        "name": "Colon High-Risk (KRAS/BRAF) - Healthy Signal",
        "profile": {"age": 62, "sex": "Male", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {"KRAS": 1, "BRAF": 1}},
        "image_path": "data/healthy_slide.png"
    },
    {
        "name": "Lung High-Risk (EGFR) - No Image",
        "profile": {"age": 55, "sex": "Female", "primary_site": "Lung", "oncotree_code": "LUAD", "mutations": {"EGFR": 1}},
        "image_path": None
    },
    {
        "name": "Breast High-Risk (ERBB2/HER2) - No Image",
        "profile": {"age": 50, "sex": "Female", "primary_site": "Breast", "oncotree_code": "IDC", "mutations": {"ERBB2": 1}},
        "image_path": None
    },
    {
        "name": "Colon Low-Risk - Tumor Signal (Incidental Detection)",
        "profile": {"age": 45, "sex": "Female", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {"APC": 1}}, # APC only is lower risk for metastasis
        "image_path": "data/positive_tumor.png"
    }
]

def run_tests():
    url = "http://127.0.0.1:8000/simulate"
    results = []
    
    print(f"{'Simulation Scenario':<45} | {'Liver Risk':<12} | {'Lung Risk':<12} | {'Vision Conf':<12} | {'Status'}")
    print("-" * 110)
    
    for s in SCENARIOS:
        payload = {
            "profile": {
                "name": s["name"],
                **s["profile"]
            },
            "image": get_img_b64(s["image_path"]) if s["image_path"] else None,
            "doctor_id": "test_bot"
        }
        
        try:
            r = requests.post(url, json=payload).json()
            liver = r['simulated_risks'].get('DMETS_DX_LIVER', 0)
            lung = r['simulated_risks'].get('DMETS_DX_LUNG', 0)
            conf = r.get('vision_confidence', 0.5)
            conclusive = r.get('is_vision_conclusive', False)
            safety = r.get('is_high_risk_genomic', False)
            
            status = []
            if safety: status.append("SAFETY_FLOOR")
            if conclusive: status.append("VISION_MODIFIED")
            else: status.append("GENOMIC_BASE")
            
            print(f"{s['name'][:45]:<45} | {liver*100:10.2f}% | {lung*100:10.2f}% | {conf:12.4f} | {', '.join(status)}")
            
        except Exception as e:
            print(f"{s['name']:<45} | FAILED: {e}")

if __name__ == "__main__":
    run_tests()
