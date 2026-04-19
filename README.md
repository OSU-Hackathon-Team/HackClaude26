# OncoPath: Multimodal Cancer Metastasis Risk Prediction

![OncoPath Hero Banner](data/slides/oncopath_hero.png)

<p align="center">
  <strong>Transforming Genomic Complexity into Clinical Insight with 3D Anatomical Visualizations and Multimodal AI.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js" alt="Three.js" />
  <img src="https://img.shields.io/badge/Anthropic-Claude--3.5-7253ed?style=for-the-badge" alt="Anthropic" />
</p>

---

## 🔬 Overview

OncoPath is a state-of-the-art AI-driven platform designed to predict organ-specific metastatic risks for cancer patients. By integrating longitudinal clinical data with genomic mutation profiles from the **MSK-MET dataset**, OncoPath provides clinicians and researchers with real-time **"What-If" simulations** to understand how specific genetic mutations (e.g., *TP53*, *KRAS*) influence cancer progression across 21 different anatomical sites.

### 🌟 Key Highlights

- **3D Metastatic HUD (Heads-Up Display):** A high-fidelity, interactive 3D anatomical viewer that visualizes risk intensity as a dynamic heatmap across the human body.
- **Multimodal Fusion Engine:** Integrates clinical tabular data, 101-gene mutation profiles, and high-fidelity pathology imaging signals using specialized Vision Encoders (Phikon).
- **OncoBot Clinical Assistant:** A specialized RAG-based clinical AI assistant restricted to oncological reasoning, providing interpreted insights directly within the dashboard.
- **Genomic Prototyping:** Real-time mutation toggling with a <50ms latency response from the FastAPI-backed XGBoost inference engine.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph "Frontend (Next.js)"
        A[3D Anatomical Viewer] --- B[Dashboard UI]
        B --- C[OncoBot AI Chat]
    end

    subgraph "Backend (FastAPI)"
        D[Inference Engine] --- E[XGBoost Ensemble]
        D --- F[SHAP Interpretability]
        G[Vision Encoder] --- H[Phikon/PyTorch]
    end

    subgraph "Data & Storage"
        I[(Supabase DB)] --- D
        J[MSK-MET Dataset] --- E
    end

    B <--> D
    C <--> |Anthropic Claude 3.5| K[Clinical Knowledge Base]
    H -.-> |Pathology Slides| G
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **3D Rendering:** Three.js, React Three Fiber, React Three Drei
- **Animations:** Framer Motion
- **Styling:** Tailwind CSS
- **Interactions:** Radix UI components

### Backend & AI
- **API:** FastAPI, Uvicorn
- **Machine Learning:** XGBoost, Scikit-learn
- **Interpretability:** SHAP
- **Vision:** PyTorch, Phikon (Pathology Foundation Model)
- **Database:** Supabase (PostgreSQL)
- **LLM Context:** Anthropic Claude (Haiku & Sonnet)

---

## 📁 Project Structure

```text
.
├── oncopath-next/          # Modern Next.js application (Dashboards & 3D Viewer)
├── scripts/                # Python backend implementation
│   ├── api_service.py       # FastAPI server for real-time inference
│   ├── train_iteration_3.py # Automated ML pipeline
│   └── extract_embeddings.py # Vision encoder for multimodal fusion
├── models/                 # Serialized XGBoost & Vision artifacts
├── iterations/             # Phase-by-phase project documentation
├── data/                   # Genomic (MSK-MET) and clinical datasets
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v18 or later
- **Python:** v3.9 or later
- **API Keys:** Claude API Key (set in `.env`)

### 1. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the Risk Simulator API
python scripts/api_service.py
```

### 2. Frontend Setup

```bash
cd oncopath-next

# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard will be live at `http://localhost:3000`.

---

## 📈 Model Performance & Validation

Our models are audited for **"Genomic Lift"**—measuring the performance improvement when adding genetic data to clinical-only baselines.
- **21 Organ Sites:** Specifically optimized models for Brain, Lung, Bone, Liver, etc.
- **Interpretability:** Exact probability reporting and SHAP force plots for transparent reasoning.
- **Validation:** Audited against clinical literature (e.g., verifying KRAS influence on Colorectal metastasis patterns).

---

## 👥 Contributors

| Name | Role |
| :--- | :--- |
| **Jason Seh** | Project Architect & ML Engineer |
| **Mitchell Eickhoff** | Full Stack Developer |
| **Konrád Gózon** | Frontend & 3D Specialist |
| **Rocky Shao** | Business Lead |

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

