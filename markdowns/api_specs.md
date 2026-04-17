# OncoPath Inference API Specification

The inference service is implemented in `scripts/inference_api/` and exposed via `scripts/api_service.py`.

## Endpoints

### `POST /simulate` (canonical)

Request body:

```json
{
  "age": 62,
  "sex": "Female",
  "primary_site": "Lung",
  "oncotree_code": "LUAD",
  "mutations": {
    "TP53": 1,
    "KRAS": 0,
    "EGFR": 1
  }
}
```

Response body:

```json
{
  "patient_age": 62,
  "primary_site": "Lung",
  "simulated_risks": {
    "DMETS_DX_LIVER": 0.45,
    "DMETS_DX_LUNG": 0.12,
    "DMETS_DX_BONE": 0.38,
    "DMETS_DX_CNS_BRAIN": 0.05
  }
}
```

### `POST /predict` (deprecated compatibility alias)

Accepts the same request body and returns the same response as `/simulate`.

### `GET /` and `GET /health`

Response body:

```json
{
  "status": "online",
  "model_count": 21,
  "models_loaded": [
    "DMETS_DX_LIVER",
    "DMETS_DX_LUNG"
  ]
}
```

## Error model

For request validation errors produced by the service:

```json
{
  "detail": {
    "code": "invalid_profile",
    "message": "Mutation value for 'TP53' must be 0 or 1."
  }
}
```

## Environment variables

- `ONCOPATH_MODEL_DIR`: optional absolute or project-relative model artifact directory.
- `ONCOPATH_CORS_ORIGINS`: optional comma-separated CORS origins.

---

> [!WARNING]
> This API is a research sandbox tool for simulated "What-If" scenarios and is not a clinical decision system.
