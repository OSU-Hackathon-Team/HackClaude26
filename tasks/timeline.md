# Experimental Timeline: LLM-Driven Treatment Simulation

This task focuses on replacing deterministic decay models with Claude 3.5 Sonnet to predict treatment-specific metastatic trajectories, grounded in the existing Seed & Soil ML inference data.

## Phase 1: LLM Treatment Agent (Backend)
- [ ] Implement `LLMTreatmentAgent` in `scripts/api_service.py`.
- [ ] Connect agent to Claude 3.5 Sonnet (via Anthropic SDK or Copilot wrapper).
- [ ] Develop data-grounded prompt:
    - Input: ML Risk Scores (Soil) + Patient Mutations (Seed) + Treatment Selection.
    - Output: Temporal risk array (months 0-120).
- [ ] Implement multi-site temporal prediction (predicting separate curves for Bone vs Lung based on treatment).

## Phase 2: Dynamic Simulation Dashboard (Frontend)
- [ ] Update `TimelinePanel.tsx` to handle treatment-specific curves from the backend.
- [ ] Wire user month selection to a global "Temporal Focus" state.
- [ ] Ensure `AnatomicalBody3D` listens to temporal risk scores for the active month.

## Phase 3: 3D Biological Visualization
- [ ] Implement "Dynamic Regression" in `AnatomicalBody3D.tsx`.
- [ ] Mesh properties (Opacity/Emissive) should normalize between "Baseline" and "Timeline Month" values.
- [ ] Add visual cues for "Treatment Effect" (e.g. glowing green highlights for regressing tumors).

## Phase 4: Validation & Parity
- [ ] Verify that Claude's predictions are biologically plausible (e.g. PARP inhibitors having higher impact on BRCA+ cases).
- [ ] Synchronize `SeedSoilAnalysis` popovers with the selected timeline month.
