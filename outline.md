# OncoPath: Multimodal Metastatic Risk Prediction

## 🌟 Overview
OncoPath is an AI-driven clinical tool designed to predict organ-specific metastatic risks by fusing clinical data, genomic mutations, and tumor imaging.

## 🚀 Iterations

### Iteration 1: Multimodal Fusion
- **Goal**: Supplement XGBoost tabular models with Image Embeddings.
- **Approach**: Use a pre-trained Pathology Foundation Model (Phikon/UNI) to extract features from tumor slides.

### Iteration 2: Interactive Timeline & Simulation
- **Goal**: Visualize tumor progression and treatment response in 3D.
- **Approach**: 
    - **Timeline**: Heuristic-based simulation using the **Gompertz Growth Model**.
    - **What-If Engine**: Claude-powered chatbot to interpret simulation states.

## 🏗️ Architecture
- **Backend**: FastAPI (Python) + PyTorch + XGBoost.
- **Frontend**: Next.js + Three.js + React Three Fiber.
- **State Management**: Zustand.
