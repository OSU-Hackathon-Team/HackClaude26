# Iteration 2: Interactive Timeline & Simulation

## 🎯 Goal
Provide a temporal view of cancer progression and treatment response using 3D visualization and an LLM-powered clinical assistant.

## 🛠️ Technical Plan

### 1. Temporal Simulation (The Engine)
- **Math**: Implement the **Gompertz Growth Equation**: $V(t) = V_0 e^{(A/B)(1 - e^{Bt})}$.
- **Treatment Interaction**: 
    - Adjust $A$ (Growth rate) and $B$ (Decay rate) based on treatment selection.
    - **Chemotherapy**: Sudden drop in $A$, spike in $B$.
    - **Oral Drugs**: Gradual shift in $A$.
- **Backend API**: New endpoint `/simulate/temporal` that returns an array of coordinates/volumes over 24 months.

### 2. 3D Body Dashboard (The UI)
- **Engine**: Three.js + React Three Fiber.
- **Visuals**: 
    - Load a `.glb` female/male anatomy model.
    - Render transparent organs.
    - Use **Shaders** to show a growing/shrinking red "Heatmap" on the afflicted organ based on the Gompertz volume.

### 3. Claude Clinical Assistant
- **Integration**: Anthropic Messages API.
- **Context Injection**: 
    - The LLM receives the patient's MSK-MET profile and the *current* simulation parameters.
    - Capability: "The doctor says 'Increase Chemo intensity to 80%'. Claude calculates the new simulation curve and updates the 3D model."

## 📦 Deliverables
- `scripts/simulation_engine.py`: Python logic for the Gompertz model.
- `oncopath-next/components/Timeline3D.tsx`: Three.js component.
- `scripts/chatbot_service.py`: Claude API wrapper.
