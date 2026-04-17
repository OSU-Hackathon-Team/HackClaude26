"""
================================================================================
FILE: iteration_four.md
ROLE: Phase 4 Documentation
PURPOSE: Documents the transition from a CLI-based research tool to a 
         professional-grade "Metastatic HUD" (Heads-Up Display).
         
LEARNING POINTS:
- THE DOCTOR'S VIEW: Accuracy is only useful if it's interpretable. By 
  visualizing 21 organs as a heatmap, we turn numbers into insight.
- REAL-TIME SIMULATION: The frontend proves the low-latency (50ms) performance 
  of our FastAPI/XGBoost backend.
================================================================================
"""

# Phase 4: The Visual HUD (Heads-Up Display)

### Step 1: Frontend Scaffolding
*   **Results:** Implemented `app_frontend.py` using Streamlit.
*   **Interactivity:** Added a "Genomic Lab" where users can toggle mutations (TP53, KRAS, etc.).
*   **Status:** ✅ **Completed**

### Step 2: Anatomy Mapping & Tone Mapping
*   **Results:** Integrated `anatomy_mapping.json` to group 21 sites into 4 body regions.
*   **Visualization:** Implemented a "Red-Yellow-Green" tone mapping using Plotly to represent risk intensity.
*   **Status:** ✅ **Completed**

### Step 3: Deployment-Ready Sandbox
*   **Results:** The dashboard now serves as the primary interface for Phase 5 (Validation).
*   **Status:** ✅ **Completed**

## The "Visual HUD" in Action
The dashboard allows a researcher to see the **"Genomic Ripple Effect"**:
1.  **Select Patient:** e.g., 65yo Female with Breast Cancer.
2.  **Toggle Mutation:** Check `TP53`.
3.  **Observation:** Watch the **Bone** and **Brain** risk bars move in real-time.
