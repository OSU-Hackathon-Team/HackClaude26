# Data Dictionary: Runtime + Modeling Fields

_Last code-verified update: 2026-04-18_

This dictionary reflects fields actively used by the current API/frontend contracts and model artifacts.

## 1. Runtime profile fields (`/simulate`)
| Field | Type | Notes |
| :--- | :--- | :--- |
| `profile.name` | string | Display/persistence identifier. |
| `profile.age` | number | Used as `AGE_AT_SEQUENCING` feature. |
| `profile.sex` | string | Encoded categorical feature. |
| `profile.primary_site` | string | Encoded categorical feature. |
| `profile.oncotree_code` | string | Encoded categorical feature. |
| `profile.mutations` | object<string, int> | Mutation toggles/values keyed by gene. |
| `image` | string \| null | Optional image (base64 or path), currently used for breast profile vision signal path. |
| `doctor_id` | string \| null | Optional persistence linkage. |

## 2. `/predict` request fields
| Field | Type | Notes |
| :--- | :--- | :--- |
| `age_at_sequencing` | number | Clinical numeric input. |
| `sex` | string | Clinical categorical input. |
| `primary_site` | string | Clinical categorical input. |
| `oncotree_code` | string | Clinical categorical input. |
| `genomic_markers` | object<string, number> | Marker/value map used to build genomic vector. |

## 3. Core model artifacts (loaded at API startup)
| Artifact | Path | Purpose |
| :--- | :--- | :--- |
| Clinical encoder | `models/clinical_encoder.joblib` | Encodes sex/site/oncotree fields. |
| Clinical scaler | `models/clinical_scaler.joblib` | Scales age field. |
| Genomic feature index | `models/genomic_features.joblib` | Canonical feature order for mutation vector. |
| Site models | `models/model_dmets_dx_*.joblib` | Organ/site risk classifiers (21 targets). |
| Vision detector | `models/vision_detector.joblib` | Optional image-based conclusive signal stage. |

## 4. Target/site keys currently modeled
`DMETS_DX_ADRENAL_GLAND`, `DMETS_DX_BILIARY_TRACT`, `DMETS_DX_BLADDER_UT`, `DMETS_DX_BONE`, `DMETS_DX_BOWEL`, `DMETS_DX_BREAST`, `DMETS_DX_CNS_BRAIN`, `DMETS_DX_DIST_LN`, `DMETS_DX_FEMALE_GENITAL`, `DMETS_DX_HEAD_NECK`, `DMETS_DX_INTRA_ABDOMINAL`, `DMETS_DX_KIDNEY`, `DMETS_DX_LIVER`, `DMETS_DX_LUNG`, `DMETS_DX_MALE_GENITAL`, `DMETS_DX_MEDIASTINUM`, `DMETS_DX_OVARY`, `DMETS_DX_PLEURA`, `DMETS_DX_PNS`, `DMETS_DX_SKIN`, `DMETS_DX_UNSPECIFIED`.

## 5. Timeline assistant payload fields
| Field | Type | Constraints in code |
| :--- | :--- | :--- |
| `patient_summary.age` | int | 0..130 |
| `patient_summary.primary_site` | string | non-empty |
| `patient_summary.key_mutations` | string[] | non-empty strings, max 50 |
| `selected_organ` | string | non-empty |
| `treatment` | string | non-empty |
| `timeline_points[].month` | int | 0..120, ascending unique |
| `timeline_points[].risk` | float | 0.0..1.0 |
| `active_month` | int | must match one timeline point month |

## 6. Training dataset conventions still referenced in scripts
- Clinical base columns: `AGE_AT_SEQUENCING`, `SEX`, `PRIMARY_SITE`, `ONCOTREE_CODE`
- Target columns: `DMETS_DX_*` with legacy `"Yes"/"No"` labels mapped to `1/0`
- Additional genomic numeric columns are discovered dynamically during training and serialized into `genomic_features.joblib`
