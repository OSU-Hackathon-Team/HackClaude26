# API Specification: OncoPath Simulation Engine

The OncoPath API is built with **FastAPI** and currently exposes two simulation endpoints:
1. `POST /simulate` for single-snapshot metastatic risk inference
2. `POST /simulate/temporal` for month-by-month progression trajectories

---

## Endpoint: `POST /simulate`

### Request Body (JSON)
```json
{
  "profile": {
    "age": 62,
    "sex": "Female",
    "primary_site": "Lung",
    "oncotree_code": "LUAD",
    "mutations": {
      "TP53": 1,
      "KRAS": 0,
      "EGFR": 1
    }
  },
  "image": "data:image/png;base64,..."
}
```

### Response Body (JSON)
```json
{
  "simulated_risks": {
    "DMETS_DX_LIVER": 0.45,
    "DMETS_DX_BONE": 0.38,
    "DMETS_DX_CNS_BRAIN": 0.05
  },
  "visual_lift": 0.08,
  "has_visual_data": true
}
```

---

## Endpoint: `POST /simulate/temporal`

### Request Body (JSON)
```json
{
  "profile": {
    "age": 62,
    "sex": "Female",
    "primary_site": "Lung",
    "oncotree_code": "LUAD",
    "mutations": {
      "TP53": 1,
      "KRAS": 0,
      "EGFR": 1
    }
  },
  "image": "data:image/png;base64,...",
  "months": 24,
  "mode": "treatment_adjusted",
  "treatment": "CHEMOTHERAPY"
}
```

### Modes
- `untreated`: natural progression trend
- `treatment_adjusted`: treatment-response trajectory (requires `treatment`)

### Supported Treatments
- `CHEMOTHERAPY`
- `IMMUNOTHERAPY`
- `ORAL_DRUG`

### Response Body (JSON)
```json
{
  "mode": "treatment_adjusted",
  "treatment": "CHEMOTHERAPY",
  "months": 24,
  "baseline_risks": {
    "DMETS_DX_LIVER": 0.45,
    "DMETS_DX_BONE": 0.38
  },
  "timeline": [
    {
      "month": 0,
      "risks": {
        "DMETS_DX_LIVER": 0.45,
        "DMETS_DX_BONE": 0.38
      },
      "max_risk": 0.45,
      "mean_risk": 0.415
    },
    {
      "month": 1,
      "risks": {
        "DMETS_DX_LIVER": 0.43,
        "DMETS_DX_BONE": 0.36
      },
      "max_risk": 0.43,
      "mean_risk": 0.395
    }
  ],
  "visual_lift": 0.08,
  "has_visual_data": true
}
```

---

> [!WARNING]
> This API is a research sandbox tool. All requests must be treated as simulated "What-If" scenarios and not as clinical commands.
