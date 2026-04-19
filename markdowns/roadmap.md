# Roadmap: OncoPath 12-Week Research & Development Plan

**Project:** OncoPath: A Predictive Metastatic Visualization Sandbox  
**Timeline:** 12-Week Comprehensive Sprint  
**Lead Engineer:** Lead Bioinformatics Engineer

---

## 🛠 Phase 1: The Empirical Baseline (Weeks 1-3)
*Goal: Establish a baseline model using verified clinical metadata to understand broad metastatic "tropism."*

*   **Data Ingestion:** Clean and validate the `data.tsv` file from the MSK-MET cohort (25,776 records).
*   **Feature Engineering:** Extract core clinical features: **Age**, **Biological Sex**, **Primary Site**, and **Histology**.
*   **Model Selection:** Implement an **XGBoost** classifier (or Random Forest) using `.predict_proba()` to generate multi-organ risk scores for sites like Liver, Lung, Bone, and Brain.
*   **Validation:** Perform **Stratified K-Fold Cross-Validation** to ensure the model's reliability across different patient demographics and histological subtypes.

## 🧬 Phase 2: The Genomic Deep-Dive (Weeks 4-7)
*Goal: Integrate molecular drivers to move from "who the patient is" to "what the tumor is doing."*

*   **Molecular Integration:** Merge clinical data with **Mutation** and **CNA** (Copy Number Alteration) data for the same cohort to build a multi-omic feature set.
*   **Driver Analysis:** Identify and include high-impact genomic markers (e.g., **TP53**, **KRAS**, **PIK3CA**, **EGFR**) as critical model features.
*   **Explainability (SHAP):** Implement a **SHAP** (SHapley Additive exPlanations) layer to provide global and local interpretability, visualizing why the model assigns high risk to specific organs.
*   **Research Review:** Compare model-identified drivers with established **"Seed and Soil"** literature to verify biological plausibility and clinical relevance.

## Phase 3: The "Total Body" Predictor (Weeks 8-11) 🗺️
*   **Goal:** Expand prediction to all 21 metastatic sites and build the simulation interface.
*   **Key Milestones:**
    *   **Dynamic Target Discovery:** Train individual XGBoost models for all 21 sites identified in data.
    *   **"What-If" Inference Engine:** FastAPI backend to allow real-time risk simulation.
    *   **The Anatomy Bridge:** Prepare data structures for 3D anatomy mapping (Phase 4).
*   **Frontend Development:** Create a professional dashboard (React/Next.js or Streamlit) featuring interactive controls for variables like "Age," "Histology," and "Mutation Presence."
*   **Visualizing Uncertainty:** Transition from static numbers to dynamic **3D Anatomy Heatmaps** or Radar Charts to represent both risk probability and confidence intervals/uncertainty.
*   **Technical Integrity:** Maintain strict de-identification protocols and frame the interface as a **"Clinical Decision Support Sandbox"** for research use.

## Phase 4: The Visual HUD (Heads-Up Display)
- **Interactive Dashboard:** Build a Streamlit app for real-time risk simulation.
- **Anatomy Mapping:** Link 21 sites to physical body regions (Head, Chest, Abdomen, Pelvis).
- **Risk Heatmap:** Visualize risk using color-coded bar charts (Tone mapping).
- **Prognostic Sandbox:** Allow users to toggle 100+ genes to see "Genomic Ripples."

## ⚖️ Phase 5: Validation & Outreach (Week 12+)
*Goal: Test the tool's robustness and prepare it for the scientific community.*

*   **External Validation:** Run the model against independent datasets (e.g., **TCGA - The Cancer Genome Atlas**) to measure generalization and cross-cohort performance.
*   **Ethical Review:** Draft a comprehensive **"Limitations & Bias"** document, detailing data sparsity in rare cancers and potential algorithmic biases.
*   **The Ohio State Connection:** Prepare a formal project presentation for the **James Cancer Center** or a faculty mentor to discuss potential research assistantship opportunities and institutional collaboration.

---

> [!IMPORTANT]
> This roadmap emphasizes scientific rigor over rapid prototyping. Each phase includes a validation step to ensure the model remains grounded in oncological reality.