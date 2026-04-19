# API Specification: Current Implemented Endpoints

_Last code-verified update: 2026-04-18_

Backend app: `scripts/api_service.py` (FastAPI)

## `GET /`
Health + model discovery.

### Response
```json
{
  "status": "online",
  "multimodal": true,
  "ensemble": true,
  "models_loaded": ["DMETS_DX_LIVER", "DMETS_DX_LUNG"]
}
```

---

## `POST /simulate`
Primary multimodal simulation endpoint used by the frontend dashboard.

### Request
```json
{
  "profile": {
    "name": "Jane Doe",
    "age": 55,
    "sex": "Female",
    "primary_site": "Breast",
    "oncotree_code": "BRCA",
    "mutations": {
      "TP53": 1,
      "PIK3CA": 1,
      "ERBB2": 1
    }
  },
  "image": "data:image/png;base64,...",
  "doctor_id": "optional-clerk-id"
}
```

### Response
```json
{
  "simulated_risks": {
    "DMETS_DX_LIVER": 0.44,
    "DMETS_DX_LUNG": 0.31
  },
  "visual_lift": 0.02,
  "has_visual_data": true,
  "vision_confidence": 0.81,
  "is_vision_conclusive": true,
  "is_high_risk_genomic": true
}
```

Notes:
- Vision signal path is currently applied for breast profiles with image input.
- Supabase persistence is optional and env-gated.

---

## `POST /predict`
Profile-only risk endpoint with confidence metrics and explainability payload.

### Request
```json
{
  "age_at_sequencing": 62,
  "sex": "Female",
  "primary_site": "Lung",
  "oncotree_code": "LUAD",
  "genomic_markers": {
    "TP53": 1,
    "KRAS": 0,
    "EGFR": 1
  }
}
```

### Response
```json
{
  "prediction_id": "uuid",
  "status": "success",
  "risk_scores": {
    "DMETS_DX_LIVER": 0.45,
    "DMETS_DX_LUNG": 0.12
  },
  "confidence_metrics": {
    "standard_deviation": 0.03,
    "calibration_score": 0.92
  },
  "shap_values": {
    "age_62": 0.01,
    "sex_female": -0.02
  }
}
```

Important:
- Current `shap_values` are deterministic demo values generated server-side, not native model SHAP output.

---

## `POST /predict/timeline`
Treatment projection timeline endpoint.

### Request
```json
{
  "baseline_risk": 0.45,
  "treatment": "CHEMOTHERAPY",
  "months": 24
}
```

### Treatment values
- `CHEMOTHERAPY`
- `IMMUNOTHERAPY`
- `TARGETED_THERAPY`
- `RADIATION`
- `OBSERVATION`

### Response
```json
{
  "status": "success",
  "treatment": "CHEMOTHERAPY",
  "timeline": [
    { "month": 0, "risk": 0.45 },
    { "month": 1, "risk": 0.43 }
  ]
}
```

---

## `POST /assistant/timeline-explain`
Plain-language explanation endpoint for timeline context.

### Request
```json
{
  "patient_summary": {
    "age": 60,
    "primary_site": "LUNG",
    "key_mutations": ["TP53", "KRAS"]
  },
  "selected_organ": "DMETS_DX_LIVER",
  "treatment": "CHEMOTHERAPY",
  "timeline_points": [
    { "month": 0, "risk": 0.45 },
    { "month": 6, "risk": 0.31 }
  ],
  "active_month": 6
}
```

### Response
```json
{
  "plain_explanation": "At month 6, estimated risk is 31%.",
  "next_step_suggestion": "Compare month 6 with nearby points before changing treatment.",
  "safety_note": "This is not medical advice."
}
```

Notes:
- Backend validates strict schema/constraints through Pydantic models.
- If Copilot service is unavailable, backend returns deterministic local fallback response with the same schema.

---

> [!WARNING]
> Research sandbox only. Outputs are simulated estimates and must not be treated as clinical directives.
