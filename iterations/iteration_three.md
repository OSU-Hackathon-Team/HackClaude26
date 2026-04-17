# Iteration Three: The "Total Body" Predictor

## Goal
Scale the predictive models from the initial 5 target sites to all 21 metastatic destinations identified in the MSK-MET dataset. This iteration implements "Dynamic Target Discovery" and robust batch training.

## Roadmap & Progress

### Step 1: Dynamic Target Discovery
*   **Results:** Automatically identified 21 metastatic sites with sufficient data (> 100 cases).
*   **Status:** ✅ **Completed**

### Step 2: Batch Training & Serialization
*   **Results:** Trained 21 XGBoost models and saved them as `.joblib` files in the `models/` directory.
*   **Status:** ✅ **Completed**

### Step 3: Global Accuracy Report
*   **Results:** Generated a master performance table showing strong predictive power across all 21 organs.
*   **Top Performers:** Female Genital (0.93 AUC), Male Genital (0.91 AUC), Bladder (0.83 AUC).
*   **Status:** ✅ **Completed**

## Global Accuracy Report: The "Genomic Signal" Audit

To address the concern of "Clinical Shortcuts" (e.g., Sex predicting Genitalia), we re-trained all 21 models with **100 genes** and compared them against a **Clinical-Only Baseline**.

| Site | Baseline AUC (Soil) | Integrated AUC (Seed+Soil) | **Genomic Lift** 🚀 |
| :--- | :--- | :--- | :--- |
| **Liver** | 0.7292 | 0.7553 | **+0.0261** |
| **Lung** | 0.6662 | 0.6913 | **+0.0251** |
| **CNS/Brain** | 0.7645 | 0.7864 | **+0.0219** |
| **Adrenal** | 0.6548 | 0.6709 | **+0.0160** |
| **Distant LN** | 0.6923 | 0.7081 | **+0.0158** |
| **PNS** | 0.6917 | 0.7073 | **+0.0156** |
| **Bone** | 0.7183 | 0.7334 | **+0.0151** |
| **Skin** | 0.7595 | 0.7691 | **+0.0096** |
| **Female Genital** | 0.9367 | 0.9367 | +0.0000 |
| **Male Genital** | 0.9227 | 0.9202 | -0.0026 |

**Lead's Analysis:**
The high scores (90%+) for genital-specific organs showed **near-zero Genomic Lift**. This confirms they are "Clinical Shortcuts" driven by the Sex feature. However, our "Lift Winners" (Liver, Lung, Brain) prove that the 100 genomic features are providing **active diagnostic value** where the clinical soil is most complex.

---

> [!NOTE]
> This iteration marks the transition from "Research Experiments" to a "Functional Toolset."
