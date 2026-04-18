# Timeline Implementation Task (Updated)

## Current implementation status (repository-aligned)
- Backend now exposes:
  - `POST /simulate`
  - `POST /predict`
  - `POST /predict/timeline`
- Frontend API layer now has:
  - normalized `PredictionSnapshot`
  - `/predict`-first toggle via env
  - automatic `/simulate` fallback on `404/405/501` and schema mismatch
  - organ-key normalization for legacy and target keys
- Frontend viewer now includes:
  - timeline panel (organ selector, treatment selector, month slider, curve)
  - deterministic local timeline generator fallback
  - optional explainability rendering (`prediction_id`, `status`, confidence metrics, SHAP)

## Phase progress

### Phase 1 — Contract stabilization + compatibility adapter
- [x] Frontend request normalizer supports `/simulate` and `/predict` payloads.
- [x] Unified `PredictionSnapshot` model (`risk_scores` + optional explainability fields).
- [x] Predict-first endpoint strategy with fallback to `/simulate`.
- [x] `/simulate` support retained.

### Phase 2 — Timeline v1 on current backend
- [x] Deterministic client timeline generator implemented.
- [x] Timeline panel UI implemented.
- [x] Treatment presets defined in `oncopath-next/lib/timeline.ts`.
- [x] Timeline source labeling implemented (`Backend Projection` / `Simulated Projection`).
- [x] Month selection wired to timeline state and active organ risk display.

### Phase 3 — `/predict` migration
- [x] Backend `POST /predict` implemented.
- [x] Backend `/simulate` preserved.
- [x] Frontend config-controlled predict-first rollout implemented.
- [ ] Shared fixture-based parity tests between `/simulate` and `/predict` are not implemented.
- [ ] Explicit parity thresholds (rank overlap + numeric tolerance) are not yet codified.

### Phase 4 — Explainability + temporal hardening
- [x] `/predict` returns `prediction_id`, `status`, `confidence_metrics`, `shap_values`.
- [x] Explainability panels render with presence checks and “Not available” fallback.
- [x] Backend `POST /predict/timeline` implemented.
- [x] Client falls back to deterministic local timeline when temporal API is unavailable.

## 3D mapping constraints status
- [x] Canonical organ-key normalization exists in frontend API adapter.
- [ ] Explicit UI “Proxy visualization” badge/label for proxy mesh mappings is still pending.
- [ ] Full exact-mesh coverage is still pending for several metastatic sites.

## Recent validation notes
- Playwright validation was run for:
  - simulate flow + timeline
  - predict flow + explainability
  - predict 404 fallback to simulate
- These Playwright runs used network route mocks for API responses.

## Remaining priority work
1. Add contract/parity tests for `/simulate` vs `/predict`.
2. Add explicit proxy-visualization labeling in 3D UI.
3. Define and enforce migration parity thresholds in automated checks.
