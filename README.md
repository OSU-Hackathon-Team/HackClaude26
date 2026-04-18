# OncoPath: Multimodal Cancer Metastasis Risk Prediction

OncoPath is a state-of-the-art AI-driven platform designed to predict organ-specific metastatic risks for cancer patients. By integrating longitudinal clinical data with genomic mutation profiles from the MSK-MET dataset, OncoPath provides clinicians and researchers with real-time "What-If" simulations to understand how specific genetic mutations influence cancer progression across 21 different anatomical sites.

## 🚀 Key Features

- **Real-Time Simulation:** Interactive "What-If" engine to observe risk changes based on genomic alterations (e.g., TP53, KRAS mutations).
- **Multimodal Integration:** Combines clinical features (Age, Sex, Primary Site) with high-dimensional genomic data.
- **Site-Specific Intelligence:** 21 individual XGBoost models optimized for specific metastatic targets (Adrenal Gland, Liver, Lung, Bone, etc.).
- **Model Interpretability:** Uses SHAP (SHapley Additive exPlanations) to provide transparent reasoning for risk predictions.
- **Anatomical Visualization:** Interactive 2D/3D heatmaps for intuitive risk assessment across the entire body.

## 🛠️ Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/), React, [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Three.js](https://threejs.org/).
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), Python, XGBoost, Scikit-learn, [SHAP](https://shap.readthedocs.io/en/latest/).
- **Deployment:** Vercel (Frontend), FastAPI/Uvicorn (Backend).

## 📁 Project Structure

- `oncopath-next/`: Modern Next.js application for the interactive dashboard.
- `scripts/`: Python implementation for data processing, model training, and the API service.
  - `api_service.py`: FastAPI server for real-time inference.
  - `train_iteration_3.py`: Automated ML pipeline for multi-site model training.
  - `extract_embeddings.py`: [NEW] Vision encoder for multimodal fusion.
- `iterations/`: Historical reports and upcoming detailed iteration plans.
- `tasks/`: Granular agent task lists for AI, Frontend, and Timeline modules.
- `contracts.md`: The "Shared Language" defining API schemas for the team.
- `models/`: Serialized models and preprocessing artifacts (`joblib`).
- `data/`: Multi-omic datasets and diagnostic reports.

## 🚦 Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.9+)

### 1. Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Start the Risk Simulator API
python scripts/api_service.py
```

### 2. Frontend Setup

```bash
cd oncopath-next

# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## 🧬 Model Training & Evaluation

Our models are audited for "Genomic Lift"—measuring the performance improvement when adding genetic data to clinical-only baselines. The pipeline utilizes:
- **Dynamic Discovery:** Automatically identifies valid targets with sufficient sample sizes.
- **Strict Leakage Prevention:** Ensures reliable evaluation by purging metadata not available at the time of sequencing.
- **Cross-Validation:** 5-fold stratified CV for robust accuracy reports.

---
*Created by [Jason Seh](https://linkedin.com/in/jason-seh)*
