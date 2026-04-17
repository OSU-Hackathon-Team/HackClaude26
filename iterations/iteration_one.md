# Iteration One: The Empirical Baseline (Weeks 1-3)

## 1. Objectives
The primary goal of Iteration One is to establish a **probabilistic baseline** using clinical metadata. This provides the "Soil" context of the "Seed and Soil" hypothesis, allowing us to quantify how much metastatic risk can be predicted from patient demographics and primary tumor characteristics alone.

## 2. Detailed Technical Plan

### A. Data Preprocessing & Cleaning
*   **Source:** `data_clean.tsv` (Merged Patient & Sample data).
*   **Imputation Strategy:**
    *   `AGE_AT_SEQUENCING`: Median imputation stratified by `ONCOTREE_CODE`.
    *   `SEX`: Removal of any rows with missing sex (extremely low frequency).
*   **Target Transformation:**
    *   Map `DMETS_DX_*` columns from "Yes"/"No" strings to binary `1/0` integers.
    *   Initialize target sites: `Liver`, `Lung`, `Bone`, `CNS/Brain`, `Adrenal Gland`.

### B. Feature Engineering
*   **Encoding:** 
    *   One-Hot Encoding for `PRIMARY_SITE` and `ONCOTREE_CODE`.
    *   Binary encoding for `SEX`.
*   **Scaling:** Standard scaling for `AGE_AT_SEQUENCING` to ensure model stability.

### C. Model Architecture (XGBoost)
*   **Configuration:** Multi-output wrapper for individual organ risk.
*   **Hyperparameters:**
    *   `max_depth`: 3-5 (Shallow trees to capture broad clinical trends without overfitting).
    *   `learning_rate`: 0.1.
    *   `n_estimators`: 100 with early stopping.
    *   `scale_pos_weight`: Adjusted for metastatic class imbalance.

## 3. Execution Steps

1.  **Script Development:** Create `train_iteration_1.py` to handle the above pipeline.
2.  **Cross-Validation:** Implement 5-fold Stratified CV to evaluate AUC-ROC and Brier Scores.
3.  **Benchmarking:** Record the "Clinic-Only" performance to serve as the baseline for Phase 2 Genomic integration.
4.  **Explainability:** Extract global SHAP values to verify that Breast/Prostate origins prioritize Bone metastasis, and Lung origins prioritize Brain, aligning with clinical literature.

## 4. Success Metrics
- **AUC-ROC > 0.70:** Achieving better-than-chance prediction using clinical features.
- **Brier Score < 0.15:** Ensuring probability calibration (risk scores reflect true incidence).
- **Stability:** Low variance (< 0.05) across CV folds.

---
> [!IMPORTANT]
> This iteration defines the "Standard of Care" baseline. Every subsequent addition (genomics, deep learning) must prove it adds significant predictive value beyond this model.
