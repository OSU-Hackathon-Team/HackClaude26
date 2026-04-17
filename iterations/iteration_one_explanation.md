# Iteration One Explanation: The Empirical Baseline

## 1. What was Accomplished?
We successfully established a **clinical predictive baseline**. By merging the MSK-MET patient and sample data into `data_clean.tsv`, we created a unified "Source of Truth" for the 25,775 patients in the cohort. We then trained an initial **XGBoost** model to predict the probability of metastasis to the Liver, Lung, Bone, Brain, and Adrenal Glands based purely on "Soil" features.

## 2. Why it's Important
This iteration sets the **performance floor**. 

### Actual Results (The "Baseline"):
| Target Organ | Mean AUC-ROC | Brier Score | Status |
| :--- | :--- | :--- | :--- |
| **CNS/Brain** | **0.7657** | 0.193 | 🚀 Strong |
| **Liver** | **0.7323** | 0.209 | ✅ Solid |
| **Bone** | **0.7170** | 0.214 | ✅ Solid |
| **Lung** | **0.6800** | 0.225 | ⚠️ Needs Genomics |
| **Adrenal** | **0.6686** | 0.214 | ⚠️ Needs Genomics |

In the "Seed and Soil" theory, we need to know how much the "Soil" (Age, Sex, Primary Origin) determines the destination. By establishing this baseline, we can accurately measure the "Genomic Lift" in Phase 2—how much *better* the model gets once we tell it about specific mutations like TP53 or KRAS. 

If the baseline is already strong, it proves that clinical context is a major driver of metastatic tropism.

## 3. Technologies & Implementation
### Tools Used:
- **Python (Pandas):** Used for the complex merge of `data_clinical_patient.txt` and `data_clinical_sample.txt`. We handled a critical `PATIENT_ID` join that synchronized demographic data with metastatic labels.
- **XGBoost (XGBClassifier):** Selected for its ability to handle categorical clinical features and its native support for `scale_pos_weight`, which we used to address the fact that most patients *do not* have metastasis to every organ (class imbalance).
- **Scikit-Learn:** Used for `StratifiedKFold` (5 folds). This is crucial because it ensures that each "test" set has the same proportion of metastatic cases as the "train" set, preventing skewed results.

### Key Configuration:
- **Encoding:** We utilized `OneHotEncoder` with `handle_unknown='ignore'` for the OncoTree codes. This ensures the model won't crash if it encounters a rare cancer type it didn't see during training.
- **Imputation:** Median age was calculated per cancer type, ensuring that a missing age for a Prostate cancer patient is filled with the median age of *other* Prostate patients, preserving clinical accuracy.

---
*Status: Baseline Established. Ready for Genomic Integration.*
