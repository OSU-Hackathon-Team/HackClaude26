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
**Endpoint**: `POST /simulate/temporal`
**Request Payload**:
```json
{
  "initial_risk": 0.45,
  "treatment": "CHEMOTHERAPY",
  "months": 24
}
```
**Response Payload**:
```json
{
  "timeline": [
    {"month": 0, "risk": 0.45},
    {"month": 6, "risk": 0.25},
    {"month": 12, "risk": 0.15},
    {"month": 24, "risk": 0.05}
  ]
}
```

---

## 4. State Management Contract (Zustand)
**Store**: `useStore`
**Keys**:
- `patientData`: Object (Profile + Image)
- `currentRisks`: Map (Site -> Probability)
- `timelineData`: Array (Gompertz outputs)
- `treatmentStrategy`: String (Chemo/Oral/etc)
