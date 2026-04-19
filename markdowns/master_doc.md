# Master Document: OncoPath Vision & Current State

_Last code-verified update: 2026-04-18_

## 1. Vision
**OncoPath** is a metastatic risk simulation platform that combines clinical profile data, genomic markers, and optional pathology image signal to support "what-if" exploration.

> [!NOTE]
> **Research support only, not diagnosis or treatment advice.**

## 2. What is implemented now
### Backend (FastAPI)
- `POST /simulate` for multimodal simulation (clinical + genomics + optional image path/base64 input)
- `POST /predict` for profile-based risk prediction with confidence metrics
- `POST /predict/timeline` for treatment timeline projection
- `POST /assistant/timeline-explain` for plain-language timeline guidance
- Optional Supabase persistence when env vars are configured

### Frontend (Next.js / React)
- Landing page + Clerk auth shell
- `/viewer` dashboard with:
  - Full-screen 3D anatomy view
  - Organ selection and risk popover
  - Genomic parameter drawer + image upload + "Run Simulation"
  - Timeline drawer (organ/treatment/month controls, playback, comparison)
  - Copilot-style assistant panel and action log
  - Macro/Micro scene mode switch (micro scene reacts to timeline risk)

### Model/runtime artifacts present
- Clinical encoder + scaler + genomic feature index in `models/`
- 21 site-specific metastatic models (`model_dmets_dx_*.joblib`)
- Vision detector (`vision_detector.joblib`)

### Regression coverage present
- Frontend mocked-backend timeline regression tests
- Real-backend Playwright E2E spec for `/simulate`, `/predict/timeline`, and assistant endpoint wiring

## 3. Temporary/provisional areas still in code
1. `/predict` explainability uses deterministic demo SHAP-like values (`_build_demo_shap_values`), not model-native SHAP output.
2. Timeline assistant depends on `github-copilot-sdk`; when unavailable, backend intentionally returns deterministic fallback explanation text.
3. Some training/data prep scripts still use machine-local Windows paths (not portable as-is).
4. Legacy Streamlit frontend (`scripts/app_frontend.py`) is not the active production UI and its payload shape is not aligned with current `/simulate` contract.

## 4. Current phase assessment
The project is beyond early roadmap planning and has a working end-to-end simulation stack (model artifacts + API + interactive frontend + E2E suites). The remaining work is mostly **validation hardening, portability cleanup, and production readiness** rather than core feature creation.
