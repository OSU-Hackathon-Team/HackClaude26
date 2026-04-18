# Iteration 1: Multimodal Fusion (Vision + Tabular)

## 🎯 Goal
Improve the AUC of site-specific metastatic risk models by supplementing the existing clinical/genomic features with visual features extracted from tumor images.

## 🛠️ Technical Plan

### 1. Vision Feature Extraction
- **Model**: Use a pre-trained **Phikon** (Pathology Foundation Model).
- **Process**: 
    - Convert H&E slides into $224 \times 224$ patches.
    - Pass patches through the ViT (Vision Transformer) encoder.
    - Perform **Mean Pooling** across patches to get a single patient-level "Image Fingerprint" (768-D vector).

### 2. Feature Stacking
- The 768-D image vector will be concatenated with the 51-D clinical/genomic vector.
- New Feature Count: $51 + 768 = 819$ features.

### 3. Training
- Retrain the 21 site-specific XGBoost models using the augmented features.
- Evaluate the "Genomic + Clinical + Visual" Lift.

## 📦 Deliverables
- `scripts/extract_embeddings.py`: A reusable PyTorch utility.
- `models/multimodal_xgboost_v1.joblib`: Serialized site models.
- Enhanced Dashboard: Support for image uploads.
