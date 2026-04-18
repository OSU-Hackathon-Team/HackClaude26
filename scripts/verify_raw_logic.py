import requests

def verify():
    url = "http://127.0.0.1:8000/simulate"
    profile = {
        "age": 65,
        "sex": "Male",
        "primary_site": "COLON",
        "oncotree_code": "COAD",
        "mutations": {"APC": 1, "KRAS": 1, "TP53": 1}
    }

    print("--- RAW API VERIFICATION ---")
    
    # 1. No Image
    r1 = requests.post(url, json={"profile": profile, "image": None}).json()
    print(f"Risk (No Image): {r1['simulated_risks']['DMETS_DX_LIVER']:.4f}")
    print(f"Confidence (No Image): {r1.get('vision_confidence', 'N/A')}")

    # 2. Scary Image
    import base64
    with open("data/positive_tumor.png", "rb") as f:
        img_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
    
    r2 = requests.post(url, json={"profile": profile, "image": img_b64}).json()
    print(f"\nRisk (Scary Image): {r2['simulated_risks']['DMETS_DX_LIVER']:.4f}")
    print(f"Confidence (Scary Image): {r2['vision_confidence']:.4f}")
    print(f"Visual Lift: {r2['visual_lift']:.4f}")

if __name__ == "__main__":
    verify()
