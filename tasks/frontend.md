# Frontend Tasks

## Iteration 1: Multimodal Dashboard
Integrate image upload and result visualization into the existing Next.js dashboard.

### Detailed Steps:
1.  **UI Components**: Build a `DragAndDropImage` component using `react-dropzone`.
2.  **State Management**: Use **Zustand** to hold the current `patientProfile` and its corresponding `imagePreview`.
3.  **Visual Feedback**: Create a 2D body heatmap that updates instantly when the FastAPI backend returns risk scores.

## Iteration 2: 3D Anatomical Timeline
Transition from 2D maps to a fully interactive 3D anatomy simulator.

### Detailed Steps:
1.  **3D Context**: Initialize `<Canvas>` from @react-three/fiber.
2.  **Model Loading**: Use `@react-three/drei`'s `useGLTF` to load the anatomical organs.
3.  **Timeline Slider**: Integrate a custom `Slider` component that triggers the Gompertz simulation backend call debounced.
4.  **Shader Logic**: Pass the "Risk Value" to a fragment shader to animate organ color (Green $\rightarrow$ Red).

## 🤝 Interface Contract (Parallel Sync)
Refer to **`contracts.md` Sections 2, 3, 4**.
- **Mocking Strategy**: Use `fetchMock` or a local JSON file to simulate `/simulate` and `/simulate/temporal` responses.
- **Agent Note**: You do NOT need the AI Model to be finished. Work with the predefined JSON schema to build the entire 3D UI today.

### Checklist:
- [ ] Set up `SimulationDashboard` component
- [ ] Implement file upload for tumor images
- [ ] Integrate 3D Timeline slider
- [ ] Integrate Claude Chatbot window
- [ ] Connect Frontend state to FastAPI `/simulate` endpoint
- [ ] Add Framer Motion animations for risk changes
