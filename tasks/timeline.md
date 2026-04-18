# Timeline Tasks

## Iteration 2: Spec-Aligned Timeline Engine
Build the temporal visualization using the API contract in `markdowns/api_specs.md`.

### Detailed Steps:
1.  **Baseline Risk Fetch**: Integrate `POST /predict` using the request schema from `api_specs.md` (`age_at_sequencing`, `sex`, `primary_site`, `oncotree_code`, `genomic_markers`).
2.  **Temporal Projection Engine**: Write a `SimulationEngine` class in Python that projects risk over $t = 1 \dots 24$ months from a selected organ baseline (`risk_scores[organ]`).
3.  **Treatment Mapping**:
    - Map `Chemotherapy` $\rightarrow$ $B = 0.5$ (high decay).
    - Map `Immunotherapy` $\rightarrow$ $A = 0.1$ (low growth).
    - Map `Oral Drug` $\rightarrow$ $A = 0.2, B = 0.1$.
4.  **Simulation Response**: The engine should return a list of dictionaries: `[{"month": 1, "risk": 0.8}, ...]`.
5.  **Explainability Sync**: Surface `confidence_metrics` and `shap_values` alongside the selected-organ timeline.

### 3D Deformation Plan
Physically show the tumor shrinking in the browser.

### Detailed Steps:
1.  **Mesh Displacement**: Use a noise-based displacement shader in Three.js.
2.  **Scale vs. Necrosis**: As volume drops, the mesh should both **scale down** and change texture to look necrotic (darker/greyer).
3.  **Transition**: Smoothly interpolate between time-steps using `lerp` in the R3F frame loop.

## 3D Asset Inventory (Current vs Needed)

### Currently Available 3D Assets in Repo
- **Format**: JSON mesh parts (no `.glb`/`.gltf` anatomy file currently committed).
- **Count**: `oncopath-next/public/derivative/` contains 363 JSON derivative files plus `human_body_metadata.json`.
- **Systems/regions available from metadata**:
  - Arteries, Veins
  - Nerves, Spinal nerves
  - Bones, Muscles, Skin
  - Lungs, Heart, Bladder
  - Brainstem
  - Gastrointestinal Tract (single grouped region)

### Current Coverage Limitations
- Several metastatic labels are currently mapped to **proxy geometry** in `AnatomicalBody3D.tsx`.
- Current proxy examples:
  - `DMETS_DX_LIVER`, `DMETS_DX_BILIARY_TRACT`, `DMETS_DX_INTRA_ABDOMINAL`, `DMETS_DX_BOWEL` -> Gastrointestinal region
  - `DMETS_DX_KIDNEY`, `DMETS_DX_ADRENAL_GLAND` -> Gastrointestinal region (fallback)
  - `DMETS_DX_BREAST`, `DMETS_DX_MALE_GENITAL`, `DMETS_DX_FEMALE_GENITAL`, `DMETS_DX_OVARY`, `DMETS_DX_DIST_LN`, `DMETS_DX_UNSPECIFIED` -> Skin/Bladder fallback
- This is good enough for a demo shell, but not anatomically precise for organ-specific prediction storytelling.

### Feasible Additions Needed to Match Prediction Meaning
1.  **Priority A (must-have for API-spec demos)**:
    - Explicit meshes for: **liver, lung, bone, brain** (sample `risk_scores` in `api_specs.md`).
2.  **Priority B (high value for multi-site risk maps)**:
    - Pleura, mediastinum, kidney, adrenal gland, bowel, biliary tract, distant lymph nodes.
3.  **Priority C (completeness for full site coverage)**:
    - Breast, ovary, male/female genital structures, skin subregions, unspecified visual bucket.
4.  **Mapping task required**:
    - Add a canonical key map between API `risk_scores` keys (for example `liver`) and mesh IDs (for example `DMETS_DX_LIVER`) to remove naming mismatch risk.
5.  **Fallback behavior required**:
    - If no organ mesh exists, render a regional highlight with explicit "proxy visualization" label in UI.

### Agent Capability Note
- Agents have access to the **Playwright MCP server**, so they can fetch/download candidate 3D assets directly (for example `.glb`/`.gltf` packs) and integrate them into the visualization pipeline.
### Additional 3d model sources. 
Open3dmodel. Found at https://anatomytool.org/open3dmodel
Please note, finding the download links may take a fair amount of exportation. 
Do so in a sub-agent

## 🤝 Interface Contract (Parallel Sync)
Refer to **`markdowns/api_specs.md`**.
- **Upstream API Endpoint**: `POST /predict`
- **Upstream Request Fields**: `age_at_sequencing`, `sex`, `primary_site`, `oncotree_code`, `genomic_markers`
- **Upstream Response Fields**: `prediction_id`, `status`, `risk_scores`, `confidence_metrics`, `shap_values`
- **Timeline Engine Input**: `risk_scores[selected_organ]` + selected `treatment`
- **Timeline Engine Output**: Array of monthly risk values for visualization
- **Agent Note**: `/simulate/temporal` is out-of-scope until it is added to `api_specs.md`.

### Checklist:
- [ ] Integrate `POST /predict` client and parse `risk_scores`
- [ ] Implement Gompertz Growth/Shrinkage Model in Python
- [ ] Define Treatment Efficacy Coefficients (Chemo, Immunotherapy, Oral) based on literature
- [ ] Bind selected organ baseline risk to timeline initialization
- [ ] Render `confidence_metrics` and `shap_values` with timeline context
- [ ] Create 3D Organ Mesh forThree.js
- [ ] Implement Voxel-based or Mesh-displacement shrinkage visual
- [ ] Connect Timeline slider to Gompertz time-steps
- [ ] Integrate "What-If" logic to modify treatment coefficients

## Additional Backend-Showcase Features (API-Spec Compatible)
All items below are achievable from `POST /predict` alone and are designed to make the timeline a backend demo surface.

### Feature Ideas:
1.  **Prediction Session Header**
    - Show `prediction_id` and `status` at the top of the timeline panel.
    - Use this as a traceable run identifier for demos and screenshots.

2.  **Top-Site Focus Mode**
    - Auto-select the highest-risk organ from `risk_scores`.
    - Let users switch target organ and instantly recompute timeline projection from that organ's baseline.

3.  **Multi-Organ Timeline Overlay**
    - Plot up to 3 organ curves at once using their `risk_scores` baselines.
    - Highlight rank changes over time ("liver overtakes bone at month 8").

4.  **Uncertainty Band Rendering**
    - Use `confidence_metrics.standard_deviation` to draw confidence ribbons around each timeline curve.
    - Include a toggle to show/hide uncertainty.

5.  **Calibration Badge**
    - Surface `confidence_metrics.calibration_score` as a visual quality indicator (high/medium/low confidence).
    - Gate aggressive "high risk" callouts behind calibration thresholds.

6.  **SHAP Driver Rail**
    - Render top positive and negative drivers from `shap_values` next to the timeline.
    - Keep this locked to the active organ selection and current simulation run.

7.  **Scenario Compare Mode (A/B)**
    - Run `/predict` twice with different `genomic_markers` and compare two timelines.
    - Show delta curve and "largest divergence month" annotation.

8.  **Waterfall-to-Timeline Link**
    - Clicking a SHAP feature pin (for example `egfr_positive`) adds an inline annotation on timeline milestones.
    - This links explainability directly to progression visuals.

### Additional Checklist:
- [ ] Add prediction run header (`prediction_id`, `status`)
- [ ] Implement top-site auto-focus from `risk_scores`
- [ ] Support 1 to 3 organ timeline overlays
- [ ] Render uncertainty ribbons from `standard_deviation`
- [ ] Add calibration status badge from `calibration_score`
- [ ] Build SHAP driver rail from `shap_values`
- [ ] Implement A/B scenario comparison via two `/predict` calls
- [ ] Add SHAP-linked timeline annotations
