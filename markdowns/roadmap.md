# Roadmap: Code-Verified Progress Tracker

_Last code-verified update: 2026-04-18_

## Status legend
- `DONE`: implemented in repository code/artifacts
- `PARTIAL`: implemented but not fully hardened/portable
- `NEXT`: not yet delivered in this repo

## Milestone status
| Milestone | Status | Evidence in code |
| :--- | :--- | :--- |
| Baseline + multi-site inference engine | DONE | `scripts/api_service.py`, `models/model_dmets_dx_*.joblib` |
| Clinical + genomic feature pipeline integration | DONE | `models/clinical_encoder.joblib`, `clinical_scaler.joblib`, `genomic_features.joblib` |
| Multimodal vision fusion path | DONE | `scripts/extract_embeddings.py`, `models/vision_detector.joblib`, `/simulate` image path |
| FastAPI serving layer | DONE | `/simulate`, `/predict`, `/predict/timeline`, `/assistant/timeline-explain` |
| Next.js interactive dashboard | DONE | `oncopath-next/app/viewer/page.tsx`, `components/BodyDashboard.tsx` |
| 3D anatomy + organ-driven interaction | DONE | `components/AnatomicalBody3D.tsx`, `lib/anatomy3d.ts` |
| Timeline simulation UX (organ/treatment/month/playback/compare) | DONE | `TimelinePanel.tsx`, `TimelineDrawer.tsx`, `lib/timeline.ts` |
| Copilot-style timeline guidance + fallback | DONE | `TimelineAssistantPanel.tsx`, `scripts/copilot_timeline_service.py` |
| MCP timeline command bridge | DONE | `scripts/mcp_timeline_server.py`, `lib/timelineCommands.ts` |
| E2E timeline regression and real-backend tests | DONE | `tests/e2e/phase5.timeline-regression.spec.ts`, `phase6.timeline-real-backend.spec.ts` |
| Native SHAP explainability in serving path | PARTIAL | `/predict` currently returns deterministic demo SHAP payload |
| Training portability and reproducibility from clean env | PARTIAL | some trainer/merge scripts use machine-local Windows paths |
| External validation (TCGA/cross-cohort) | NEXT | no implemented TCGA evaluation workflow in repository code |
| Production deployment/IaC/CI hardening | NEXT | no deployment pipeline specification in `markdowns/` or repo CI configs |

## Temporary/provisional states currently tracked
1. Demo explainability output in `/predict` (not native SHAP inference).
2. Assistant depends on `github-copilot-sdk`; fallback path is expected behavior when unavailable.
3. Legacy Streamlit UI remains in repo but is not the active frontend path.
4. Training scripts include local-path assumptions that need portability cleanup.

## Practical interpretation
The project has moved from planning into a **working integrated prototype**: model artifacts, API, modern frontend, 3D interaction, timeline assistant, and E2E scaffolding are all present. Remaining roadmap risk is concentrated in **scientific validation depth** and **production hardening**, not core feature availability.
