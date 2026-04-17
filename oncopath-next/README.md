# OncoPath Next.js Frontend

This app is the web client for the OncoPath FastAPI inference backend.

## Local development

```bash
npm ci
npm run dev
```

The app runs at `http://localhost:3000`.

## Backend connection

Set the API base URL with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

If not set, the frontend defaults to `http://127.0.0.1:8000`.

## Contract

The frontend uses the canonical `POST /simulate` endpoint and expects:

```json
{
  "patient_age": 65,
  "primary_site": "Lung",
  "simulated_risks": {
    "DMETS_DX_LIVER": 0.41
  }
}
```
