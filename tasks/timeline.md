# Timeline Tasks

## Iteration 2: Gompertz Simulation Engine
Build the mathematical core that powers the temporal visualization.

### Detailed Steps:
1.  **Gompertz Implementation**: Write a `SimulationEngine` class in Python that calculates $V(t)$ for $t = 1 \dots 24$ months.
2.  **Treatment Mapping**: 
    - Map `Chemotherapy` $\rightarrow$ $B = 0.5$ (high decay).
    - Map `Immunotherapy` $\rightarrow$ $A = 0.1$ (low growth).
    - Map `Oral Drug` $\rightarrow$ $A = 0.2, B = 0.1$.
3.  **Simulation Response**: The engine should return a list of dictionaries: `[{"month": 1, "volume": 0.8}, ...]`.

### 3D Deformation Plan
Physically show the tumor shrinking in the browser.

### Detailed Steps:
1.  **Mesh Displacement**: Use a noise-based displacement shader in Three.js.
2.  **Scale vs. Necrosis**: As volume drops, the mesh should both **scale down** and change texture to look necrotic (darker/greyer).
3.  **Transition**: Smoothly interpolate between time-steps using `lerp` in the R3F frame loop.

## 🤝 Interface Contract (Parallel Sync)
Refer to **`contracts.md` Section 3**.
- **Input**: `initial_risk` (float 0-1), `treatment` (string).
- **Output**: Array of monthly risk values.
- **Agent Note**: You are the "Bridge" between AI and Frontend. You can implement the Gompertz math library and the 3D shaders without waiting for the live XGBoost data.

### Checklist:
- [ ] Implement Gompertz Growth/Shrinkage Model in Python
- [ ] Define Treatment Efficacy Coefficients (Chemo, Immunotherapy, Oral) based on literature
- [ ] Create 3D Organ Mesh forThree.js
- [ ] Implement Voxel-based or Mesh-displacement shrinkage visual
- [ ] Connect Timeline slider to Gompertz time-steps
- [ ] Integrate "What-If" Claude logic to modify treatment coefficients
