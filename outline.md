# OncoPath: Multimodal Metastatic Risk Prediction

## 🌟 Overview
OncoPath is an AI-driven clinical tool designed to predict organ-specific metastatic risks by fusing clinical data, genomic mutations, and tumor imaging.

## 🚀 Iterations

### Iteration 1: Multimodal Fusion (Complete)
- **Goal**: Supplement XGBoost tabular models with Image Embeddings.
- **Approach**: Use a pre-trained Pathology Foundation Model (Phikon/UNI) to extract features from tumor slides.

### Iteration 2: Ensemble Signal & Clinical Audit (Complete)
- **Goal**: Solve signal scarcity and validate against oncological literature.
- **Approach**: 
    - **Ensemble Layer 2**: Specialized `vision_detector.joblib` for conclusive image influence (>70% or <30% confidence).
    - **Clinical Audit**: Verified model accuracy against KRAS (Colon), HER2 (Breast), and EGFR (Lung) metastatic patterns.
- **Outcome**: Model demonstrates strong organotropism (e.g., HER2 $\rightarrow$ 8.5% Liver Risk Lift).

## 🏗️ Architecture
- **Status**: `ITERATION_2_COMPLETE`
- **Backend**: FastAPI (Python) + PyTorch + XGBoost.
- **Frontend**: Next.js + Three.js + React Three Fiber.
- **State Management**: Zustand.
