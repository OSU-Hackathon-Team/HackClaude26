# System Contracts & API Schemas

This document acts as the "Single Source of Truth" for all agents working on OncoPath. Adherence to these schemas allows for parallel development.

---

## 1. AI Model ↔ Backend Contract
**Task**: `scripts/extract_embeddings.py`
**Input**: Image File (Path or Base64)
**Output**: `numpy.ndarray` (Shape: `[1, 768]`)

---

## 2. API ↔ Frontend Contract (Multimodal)
**Endpoint**: `POST /simulate`
**Request Payload**:
```json
{
  "profile": {
    "age": 60,
    "sex": "Male",
    "primary_site": "LUNG",
    "oncotree_code": "NSCLC",
    "mutations": {"TP53": 1, "KRAS": 0}
  },
  "image": "base64_string_here"
}
```
**Response Payload**:
```json
{
  "simulated_risks": {
    "LIVER": 0.45,
    "BONE": 0.12,
    "BRAIN": 0.05
  },
  "visual_lift": +0.08
}
```

---

## 3. Timeline ↔ Frontend Contract
**Endpoint**: `POST /predict/timeline`
**Request Payload**:
```json
{
  "baseline_risk": 0.45,
  "treatment": "CHEMOTHERAPY",
  "months": 24
}
```
**Field Constraints**:
- `baseline_risk`: float in `[0.0, 1.0]`
- `treatment`: string, one of `CHEMOTHERAPY`, `IMMUNOTHERAPY`, `TARGETED_THERAPY`, `RADIATION`, `OBSERVATION`
- `months`: integer in `[1, 120]`

**Response Payload**:
```json
{
  "status": "success",
  "treatment": "CHEMOTHERAPY",
  "timeline": [
    {"month": 0, "risk": 0.45},
    {"month": 6, "risk": 0.25},
    {"month": 12, "risk": 0.15},
    {"month": 24, "risk": 0.05}
  ]
}
```

---

## 4. Timeline Assistant ↔ Frontend Contract
**Endpoint**: `POST /assistant/timeline-explain`
**Request Payload**:
```json
{
  "patient_summary": {
    "age": 60,
    "primary_site": "LUNG",
    "key_mutations": ["TP53", "KRAS"]
  },
  "selected_organ": "LIVER",
  "treatment": "CHEMOTHERAPY",
  "timeline_points": [
    {"month": 0, "risk": 0.45},
    {"month": 6, "risk": 0.32},
    {"month": 12, "risk": 0.24}
  ],
  "active_month": 6
}
```
**Field Constraints**:
- `patient_summary.age`: integer in `[0, 130]`
- `patient_summary.primary_site`: non-empty string
- `patient_summary.key_mutations`: array of non-empty strings (max 50)
- `selected_organ`: non-empty string
- `treatment`: non-empty string
- `timeline_points`: non-empty array of unique month points sorted ascending
- `timeline_points[].month`: integer in `[0, 120]`
- `timeline_points[].risk`: float in `[0.0, 1.0]`
- `active_month`: integer in `[0, 120]` and must exist in `timeline_points[].month`

**Response Payload**:
```json
{
  "plain_explanation": "Risk is trending down over the selected months with treatment. The current month still shows meaningful risk, so monitoring remains important.",
  "next_step_suggestion": "Move the month slider forward to compare how risk changes after month 6.",
  "safety_note": "This is not medical advice."
}
```
**Response Constraints**:
- `plain_explanation`: 1-2 sentences
- `next_step_suggestion`: non-empty UI action guidance
- `safety_note`: must be exactly `"This is not medical advice."`

---

## 5. State Management Contract (Zustand)
**Store**: `useStore`
**Keys**:
- `patientData`: Object (Profile + Image)
- `currentRisks`: Map (Site -> Probability)
- `timelineData`: Array (Gompertz outputs)
- `treatmentStrategy`: String (Chemo/Oral/etc)
