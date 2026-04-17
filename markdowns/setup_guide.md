# Developer Setup Guide: OncoPath Sandbox

This guide provides the technical foundation for executing the 12-week OncoPath roadmap.

## 1. Data Acquisition (CRITICAL)
Your work involves two distinct data layers:

### Clinical Layer (Phase 1 Ready)
- **File:** `data.tsv` (already in root)
- **Content:** Patient age, sex, primary site, and metastatic target labels.

### Genomic Layer (Required for Phase 2)
- **Action:** Download the Full Study Archive.
- **Source Link:** [msk_met_2021.tar.gz (cBioPortal)](https://datahub.assets.cbioportal.org/msk_met_2021.tar.gz)
- **File to Extract:** `data_mutations_extended.txt`.

## 2. Environment Configuration
```powershell
# Create & Activate Virtual Env
python -m venv venv
.\venv\Scripts\Activate

# Install Production Dependencies
pip install pandas numpy scikit-learn xgboost shap fastapi uvicorn pydantic
```

## 3. File Architecture
```text
CancerPrediction/
├── baseline_analytics.py # Establishing the Phase 1 benchmark
├── data_dictionary.md   # Feature/Header mapping
├── master_doc.md        # Vision and scientific grounding
├── roadmap.md           # 12-week sprint plan
├── setup_guide.md       # This document
└── data.tsv             # Primary data source
```

## 4. Verification Milestone
Before starting Phase 1, ensure you can run:
```python
import pandas as pd
df = pd.read_csv('data.tsv', sep='\t')
print(df['Primary Tumor Site'].value_counts().head())
```
*If this prints the top cancer types (Lung, Colorectal, etc.), your clinical layer is healthy.*

---
> [!TIP]
> Always treat the `Sample ID` as the unique key when merging the genomic layer in Phase 2.
