# OncoPath

OncoPath predicts organ-specific metastatic risk from a patient profile and mutation set. The repo now uses a single inference contract shared by the FastAPI backend and the Next.js frontend.

## Core architecture

- `scripts/inference_api/`: canonical FastAPI inference service modules (settings, schemas, loading, simulation logic).
- `scripts/api_service.py`: compatibility entrypoint (`python scripts/api_service.py`).
- `oncopath-next/`: web frontend and typed API client.
- `models/`: trained model artifacts (`clinical_*`, `genomic_features`, `model_*.joblib`).
- `data/`: source data and anatomy metadata.

## Canonical inference interface

- **Primary endpoint:** `POST /simulate`
- **Compatibility alias:** `POST /predict` (deprecated alias to `/simulate`)

Request body:

```json
{
  "age": 65,
  "sex": "Male",
  "primary_site": "Lung",
  "oncotree_code": "LUAD",
  "mutations": {
    "TP53": 1,
    "KRAS": 1
  }
}
```

Response body:

```json
{
  "patient_age": 65,
  "primary_site": "Lung",
  "simulated_risks": {
    "DMETS_DX_LIVER": 0.41,
    "DMETS_DX_BONE": 0.52
  }
}
```

Validation errors return:

```json
{
  "detail": {
    "code": "invalid_profile",
    "message": "Mutation value for 'TP53' must be 0 or 1."
  }
}
```

## Run locally

### Backend (FastAPI)

```bash
pip install pandas numpy scikit-learn xgboost fastapi uvicorn pydantic joblib
python scripts/api_service.py
```

Optional backend environment variables:

- `ONCOPATH_MODEL_DIR` (default: `<repo>/models`)
- `ONCOPATH_CORS_ORIGINS` (comma-separated, default: `http://localhost:3000`)

### Frontend (Next.js)

```bash
cd oncopath-next
npm ci
npm run dev
```

Optional frontend environment variable:

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://127.0.0.1:8000`)

## Documentation map

- `markdowns/api_specs.md`: authoritative API contract and error model.
- `markdowns/README.md`: doc index and historical doc pointers.
