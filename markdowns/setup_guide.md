# Developer Setup Guide: Current Runtime

_Last code-verified update: 2026-04-18_

This setup reflects the **current implemented stack** (FastAPI backend + Next.js frontend), not the older planning-only layout.

## 1. Prerequisites
- Python 3.10+ recommended
- Node.js 18+ and npm

## 2. Backend setup (repository root)
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Optional backend env vars
- `ONCOPATH_MODEL_DIR` (defaults to `./models`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (enables persistence)
- `ONCOPATH_REAL_DATA_PATH` (defined in code, currently not required for API startup)

### Run backend
```bash
python -m scripts.api_service
```
Backend default URL: `http://127.0.0.1:8000`

## 3. Frontend setup (`oncopath-next/`)
```bash
cd oncopath-next
npm install
npm run dev
```
Frontend default URL: `http://localhost:3000`

### Frontend runtime env vars
Set in `oncopath-next/.env.local` when needed:
```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_TIMEOUT_MS=20000
```

For local/E2E auth bypass:
```bash
NEXT_PUBLIC_E2E_DISABLE_CLERK=1
```

## 4. Quick health checks
```bash
curl http://127.0.0.1:8000/
```
Expected: JSON with `"status": "online"` and loaded model keys.

## 5. E2E validation entrypoints
From `oncopath-next/`:
```bash
# Mocked backend regression suite
npm run test:playwright:timeline

# Real FastAPI + frontend integration suite
npm run test:playwright:real-backend
```

## 6. Important implementation notes
- Active frontend is the Next.js viewer (`/viewer`) with 3D anatomy + timeline drawers.
- `scripts/app_frontend.py` is a legacy Streamlit prototype and not the primary UI path.
- Runtime expects serialized model artifacts in `models/` (already present in this repo).
