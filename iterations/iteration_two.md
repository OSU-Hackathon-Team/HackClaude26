# Iteration Two: The Genomic Deep-Dive (Weeks 4-7)

## 1. Objectives
The goal of Iteration Two is to integrate **molecular drivers** (The "Seed") into our clinical model. We want to see if specific mutations (like TP53, KRAS, or EGFR) provide a "Genomic Lift"—making our predictions significantly more accurate than the clinical baseline.

## 2. Detailed Technical Plan

### A. Genomic Data Extraction
*   **Source:** `msk_met_2021/data_mutations.txt` inside the `data.gz` archive.
*   **Target Genes:** We will prioritize high-impact drivers: `TP53`, `KRAS`, `PIK3CA`, `EGFR`, `APC`, `PTEN`, and `BRAF`.
*   **Preprocessing:** 
    *   Filter the 76MB mutation file for "nonsynonymous" mutations.
    *   Create a "Mutation Matrix" (Patient ID x Gene) where `1` = Mutated and `0` = Wild-type.

### B. Molecular Integration (The Merge)
*   **Join:** Inner join the Mutation Matrix with `data_clean.tsv` on `PATIENT_ID`.
*   **Feature Expansion:** The feature space will expand from ~280 columns to include binary flags for our target genes.

### C. Model Training & Comparison
*   **Strategy:** Retrain the multi-output XGBoost model using the combined Clinical + Genomic feature set.
*   **Metrics:** We will compare the new AUC-ROC scores against the Phase 1 Baseline.
    *   *Success Metric:* A **>0.05 increase in AUC** for at least two metastatic sites.

### D. Explainability (SHAP Deep-Dive)
*   **Tool:** `SHAP` library.
*   **Analysis:** Visualize how specific mutations (The Seed) interact with the Primary Site (The Soil). For example: *"Does a KRAS mutation in Lung cancer increase Liver risk more than it does in Colon cancer?"*

## 4. Step-by-Step Execution (Awaiting Approvals)

### Step 1: Mutation Extraction & Matrix Creation
*   **Goal:** Extract `TP53`, `KRAS`, `PIK3CA`, `EGFR`, `APC`, `PTEN`, `AR`, `BRAF` from `data_mutations.txt`.
*   **Results:** Created `data/mutation_matrix.tsv` with **18,734** sequenced samples.
*   **Status:** ✅ **Completed**

### Step 2: Multi-Omic Merge
*   **Goal:** Combine the clinical baseline (`data_clean.tsv`) with the new mutation matrix.
*   **Results:** Created `data/data_multiomic.tsv` with **18,734** integrated patient records.
*   **Status:** ✅ **Completed**

### Step 3: Integrated Model Training
*   **Results:** Observed "Soil Dominance" with minimal lift from 8 genes.
*   **Status:** ✅ **Completed**

### Step 4: Feature Expansion (Top 50 Genes)
*   **Goal:** combat "Soil Dominance" by providing a higher-resolution genomic signature.
*   **Method:** Update `extract_genomics.py` to target the Top 50 mutations by frequency.
*   **Status:** 🟡 **Executing (Identifying Top 50 Genes)**

---

### Step 5: SHAP Interpretability (The "X-Ray")
*   **Results:** Identified **FGA** as the primary genomic driver for Lung metastasis (+0.036 lift).
*   **Status:** ✅ **Completed**

---
> [!IMPORTANT]
> **Awaiting Lead Approval.** We will not proceed with script execution until the Navigation Protocol is satisfied.
