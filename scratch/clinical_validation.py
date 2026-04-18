import joblib
import pandas as pd
import numpy as np
import os
import sys
import json
# Add project root to path for imports
sys.path.append(os.getcwd())
try:
    from scripts.extract_embeddings import VisionEncoder
except ImportError:
    sys.path.append('..')
    from scripts.extract_embeddings import VisionEncoder

# Relative paths
MODEL_DIR = 'models'
SCARY_TUMOR = 'data/scary_tumor.png'
HEALTHY_SEED_JSON = 'scratch/healthy_features.json'

def load_artifacts():
    print("Loading preprocessing artifacts...")
    encoder = joblib.load(os.path.join(MODEL_DIR, 'clinical_encoder.joblib'))
    scaler = joblib.load(os.path.join(MODEL_DIR, 'clinical_scaler.joblib'))
    genomic_features = joblib.load(os.path.join(MODEL_DIR, 'genomic_features.joblib'))
    
    print("Loading Decision Engine artifacts...")
    vision_detector = None
    if os.path.exists(os.path.join(MODEL_DIR, 'vision_detector.joblib')):
        vision_detector = joblib.load(os.path.join(MODEL_DIR, 'vision_detector.joblib'))
        print("Vision Detector online.")
    
    model_files = [f for f in os.listdir(MODEL_DIR) if f.startswith('model_') and f.endswith('.joblib')]
    models = {f.replace('model_', '').replace('.joblib', '').upper(): joblib.load(os.path.join(MODEL_DIR, f)) for f in model_files}
    
    return encoder, scaler, genomic_features, models, vision_detector

def run_multimodal_inference(profile, image_signal, encoder, scaler, genomic_features, models, vision_detector, vision_encoder):
    # 1. Tabular Baseline
    clinical_df = pd.DataFrame([{
        'AGE_AT_SEQUENCING': profile['age'],
        'SEX': profile['sex'],
        'PRIMARY_SITE': profile['primary_site'],
        'ONCOTREE_CODE': profile['oncotree_code']
    }])
    
    X_num = scaler.transform(clinical_df[['AGE_AT_SEQUENCING']])
    X_cat = encoder.transform(clinical_df[['SEX', 'PRIMARY_SITE', 'ONCOTREE_CODE']])
    mut_vector = [profile['mutations'].get(feat, 0) for feat in genomic_features]
    X_genomic = np.array([mut_vector])
    X_baseline = np.hstack([X_num, X_cat, X_genomic])
    
    # 2. Vision Influence
    vision_confidence = 0.5
    is_vision_conclusive = False
    
    v_vec = None
    if isinstance(image_signal, str) and image_signal.endswith('.png'):
        v_vec = vision_encoder.get_embeddings(image_signal)
    elif isinstance(image_signal, list):
        v_vec = np.array([image_signal])
        
    if v_vec is not None and vision_detector:
        vision_confidence = float(vision_detector.predict_proba(v_vec)[0][1])
        if vision_confidence > 0.7 or vision_confidence < 0.3:
            is_vision_conclusive = True

    # 3. Fusion Logic
    risks = {}
    for site, model in models.items():
        prob_base = float(model.predict_proba(X_baseline)[0][1])
        if is_vision_conclusive:
            if vision_confidence > 0.7:
                lift = (vision_confidence - 0.7) / 0.3 * 0.4
                prob_final = min(0.95, prob_base + lift)
            else:
                drain = (0.3 - vision_confidence) / 0.3 * 0.2
                prob_final = max(0.01, prob_base - drain)
        else:
            prob_final = prob_base
        risks[site] = prob_final
        
    return risks, vision_confidence, is_vision_conclusive

def validate():
    encoder, scaler, genomic_features, models, vision_detector = load_artifacts()
    vision_encoder = VisionEncoder()
    
    # Common Driver Scenarios
    scenarios = [
        {
            "category": "COLORECTAL (COAD)",
            "profiles": [
                {"name": "COAD Standard", "age": 62, "sex": "Male", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {}},
                {"name": "COAD High-Risk (KRAS/TP53)", "age": 62, "sex": "Male", "primary_site": "Colon", "oncotree_code": "COAD", "mutations": {"KRAS": 1, "TP53": 1, "SMAD4": 1, "BRAF": 1}}
            ]
        },
        {
            "category": "BREAST (IDC)",
            "profiles": [
                {"name": "BRCA Luminal", "age": 50, "sex": "Female", "primary_site": "Breast", "oncotree_code": "IDC", "mutations": {"PIK3CA": 1}},
                {"name": "BRCA HER2+ (Enriched)", "age": 50, "sex": "Female", "primary_site": "Breast", "oncotree_code": "IDC", "mutations": {"ERBB2": 1, "TP53": 1}}
            ]
        },
        {
            "category": "LUNG (LUAD)",
            "profiles": [
                {"name": "LUAD Standard", "age": 65, "sex": "Female", "primary_site": "Lung", "oncotree_code": "LUAD", "mutations": {}},
                {"name": "LUAD EGFR-Mutant", "age": 65, "sex": "Female", "primary_site": "Lung", "oncotree_code": "LUAD", "mutations": {"EGFR": 1}}
            ]
        }
    ]

    print("\n" + "="*80)
    print("      ONCOPATH FULL EVALUATION REPORT: COMMON METASTATIC MUTATIONS")
    print("="*80)
    
    top_n = 5
    for cat in scenarios:
        print(f"\n>>> CATEGORY: {cat['category']}")
        print("-" * 80)
        
        for profile_data in cat['profiles']:
            name = profile_data.pop('name')
            # Run Genomic Only baseline for this "Evaluation"
            risks, _, _ = run_multimodal_inference(profile_data, None, encoder, scaler, genomic_features, models, vision_detector, vision_encoder)
            
            # Sort sites by risk
            sorted_risks = sorted(risks.items(), key=lambda x: x[1], reverse=True)[:top_n]
            
            print(f"\nProfile: {name}")
            print(f"{'Metastatic Site':<25} | {'Risk Probability'}")
            print("-" * 45)
            for site, prob in sorted_risks:
                # Clean up site name (e.g., DMETS_DX_LIVER -> LIVER)
                clean_name = site.replace('DMETS_DX_', '').replace('_', ' ')
                print(f"{clean_name:<25} | {prob:>16.2%}")
        
    print("\n" + "="*80)
    print("Audit Complete. These probabilities represent the Genomic Baseline for common drivers.")
    print("="*80)

if __name__ == "__main__":
    validate()
