# Master Document: OncoPath Vision & Strategy

## 1. Project Vision
**OncoPath** is a Predictive Metastatic Visualization Sandbox designed to bridge the gap between reactive cancer monitoring and proactive risk simulation. By leveraging the 25,000+ records of the **MSK-MET (2021)** cohort, this tool simulates "What-If" scenarios to predict the probability and confidence of cancer spreading to specific target organs.

## 2. Scientific Grounding: "Seed and Soil"
The model is anchored in Paget’s **"Seed and Soil"** hypothesis. We analyze the interplay between:
*   **The Seed (Genomics):** Mutation status (TP53, KRAS), chromosomal instability (FGA), and histology.
*   **The Soil (Clinical):** Patient age, biological sex, and the physiological environment of target organs.

> [!NOTE]
> **Clinical Support, Not Diagnosis:** OncoPath provides probabilistic risk metrics intended for **Decision Support**. It empowers clinicians to prioritize screening intervals and visualize potential metastatic pathways before symptoms arise.

## 3. Technical Strategy (12-Week Roadmap)
*   **Phase 1 (Baseline):** Training XGBoost models on clinical metadata to establish a "Tropism Map."
*   **Data Layer:** MSK-MET (2021) cohort. We use **`data_clean.tsv`** (a merge of patient and sample records) for clinical features, and anticipate merging with mutation-level data in Phase 2.
*   **Phase 2 (Genomics):** Merging bulk mutation data (`data_mutations_extended.txt`) to identify molecular drivers of spread.
*   **Phase 3 (Sandbox):** Deploying a **FastAPI** backend and **React** frontend for real-time parameter tuning ("What if this patient had an EGFR mutation?").
*   **Phase 4 (Validation):** External validation against **TCGA** data and community outreach at **The James Cancer Center**.

## 4. Tech Stack
*   **Analysis:** Python (Pandas, Scikit-Learn).
*   **Engine:** XGBoost (Probabilistic Classifier).
*   **Explainability:** SHAP (Shapley Additive exPlanations).
*   **Delivery:** FastAPI, Next.js, and 3D Anatomical Visualization.

---
*Research-oriented. Ethics-driven. Data-centric.*
