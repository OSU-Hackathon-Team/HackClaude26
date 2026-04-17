# Data Dictionary: OncoPath Project (Verified Headers)

This dictionary uses the **verified raw headers** from the MSK-MET (2021) study download, now consolidated in `data_clean.tsv`.

## 1. Core Clinical Features (The "Soil")
These define the patient's baseline risk profile.

| Feature Name | Header in `data_clean.tsv` | Type | Possible Values |
| :--- | :--- | :--- | :--- |
| **Age** | `AGE_AT_SEQUENCING` | Numeric | Age (Years) at time of sequencing. |
| **Sex** | `SEX` | Categorical | 'Female', 'Male'. |
| **Primary Site** | `PRIMARY_SITE` | Categorical | Site of origin (e.g., 'Lung', 'Breast'). |
| **Histology** | `CANCER_TYPE_DETAILED` | Categorical | Specific histological subtype. |
| **OncoTree** | `ONCOTREE_CODE` | Categorical | Standardized cancer code (e.g., 'LUAD'). |

## 2. Genomic Drivers (The "Seed")
Merged from the clinical files; gene-specific markers (TP53, etc.) reside in `data_mutations_extended.txt`.

| Feature Name | Header in `data_clean.tsv` | Type | Significance |
| :--- | :--- | :--- | :--- |
| **Mut. Count** | `MUTATION_COUNT` | Numeric | Total identified mutations. |
| **TMB** | `TMB_NONSYNONYMOUS` | Numeric | Tumor Mutational Burden. |
| **FGA** | `FGA` | Numeric | Fraction of Genome Altered. |
| **MSI** | `MSI_SCORE` | Numeric | Microsatellite Instability. |
| **Purity** | `TUMOR_PURITY` | Numeric | Control for sample cellularity. |

## 3. Metastatic Target Labels (Targets)
These columns indicate where the cancer was present at the time of the study record.

> [!IMPORTANT]
> **Encoding:** These columns use **'Yes'** and **'No'** string labels. In Phase 1 modeling, we will map these to `1` (Yes) and `0` (No).

| Target Site | Column Header |
| :--- | :--- |
| **Liver** | `DMETS_DX_LIVER` |
| **Lung** | `DMETS_DX_LUNG` |
| **Bone** | `DMETS_DX_BONE` |
| **Brain** | `DMETS_DX_CNS_BRAIN` |
| **Adrenal** | `DMETS_DX_ADRENAL_GLAND` |
| **Pleura** | `DMETS_DX_PLEURA` |

## 4. Outcomes
- **Survival:** `OS_MONTHS`, `OS_STATUS`.
- **Burden:** `MET_COUNT`, `MET_SITE_COUNT`.

---
*Verified against `data_clean.tsv` - 2026-02-25*
