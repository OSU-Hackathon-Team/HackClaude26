# Developer Setup Guide: OncoPath

## 1. Local prerequisites

- Python 3.9+
- Node.js 18+

## 2. Python environment

```bash
python -m venv .venv
source .venv/bin/activate
pip install pandas numpy scikit-learn xgboost fastapi uvicorn pydantic joblib streamlit plotly requests
```

## 3. Frontend environment

```bash
cd oncopath-next
npm ci
```

## 4. Runtime configuration

Backend:

- `ONCOPATH_MODEL_DIR` (optional, default: `<repo>/models`)
- `ONCOPATH_CORS_ORIGINS` (optional, comma-separated)

Frontend:

- `NEXT_PUBLIC_API_BASE_URL` (optional, default: `http://127.0.0.1:8000`)

## 5. Run services

Backend:

```bash
python scripts/api_service.py
```

Frontend:

```bash
cd oncopath-next
npm run dev
```

Streamlit client (optional):

```bash
python scripts/app_frontend.py
```

## 6. Core repository layout

```text
CancerPrediction/
├── scripts/inference_api/   # canonical FastAPI inference modules
├── scripts/api_service.py   # backend entrypoint
├── oncopath-next/           # Next.js frontend
├── models/                  # trained model artifacts
├── data/                    # dataset and anatomy assets
└── markdowns/               # docs
```
