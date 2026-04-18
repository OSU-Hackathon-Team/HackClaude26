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

## Iteration 3: "Dark Clinical" UI Overhaul
Transform the prototype into a professional medical platform with a high-contrast, strict palette.

### 🎨 Design System
- **Background**: `bg-zinc-950` (Deep black/gray for focus)
- **Cards**: `bg-zinc-900/50` (Semi-transparent "Glass" effect with `backdrop-blur-md`)
- **Primary Text**: `text-blue-400` ("Safe" clinical data / Navigation)
- **Danger Text**: `text-red-500` (High-risk metastatic markers)
- **Border**: `border-zinc-800` (Subtle separation of data sections)
- **Typography**: Target 'Inter' or 'Geist' font with high-contrast colors (zinc-100 for headings, zinc-400 for body).

### 🏗️ Layout Shell (Dashboard Structure)
- **Left Sidebar**: Navigation (Dashboard, Patient History, Scans, Settings).
- **Top Header**: Search bar for "Patient ID" and a "System Health" indicator.
- **Main Content**: A masonry grid of cards.

### 🧪 Core Components
1.  **Patient Header**: Display profile identity using Shadcn/ui Badges to highlight high-risk mutations.
2.  **Risk Gauge**: A wide, thin progress bar.
    - Blue if risk is < 10%
    - Orange if risk is > 20%
    - Red if risk is > 50%
    - Small contextual link: "Explain clinical reasoning." next to the percentage.

### ✅ Bulk Refactor Checklist
- [ ] Refactor all components in `@/components` to follow the "Dark Clinical" aesthetic.
- [ ] Implement `backdrop-blur-md` on all overlays.
- [ ] Add subtle pulsing animations to risk components using Tailwind's `animate-pulse` at low opacity.
- [ ] Establish the Dashboard Sidebar layout.

## Iteration 5: Clean-Room Rebuild — "Medical Cockpit" ✅ IN PROGRESS
Full rebuild following the Lead UI/UX spec. AnatomicalBody3D is the hero. All config is hidden.

### Architecture
```
app/
  layout.tsx           ← Minimal: dark bg, Clerk auth fixed overlay
  viewer/page.tsx      ← Mounts <BodyDashboard /> only

components/
  BodyDashboard.tsx    ← Orchestrator: state, simulation, popover logic
  AnatomicalBody3D.tsx ← Core 3D asset — gets onOrganSelect prop added
  ui/
    OrganPopover.tsx   ← Glass card at mouse coords: risk + mutations + timeline
    GenomicDrawer.tsx  ← FAB → slide-in panel for patient parameters
```

### Design System (orange accent, zinc dark)
| Token | Value |
|---|---|
| Background | `zinc-950` `#09090b` |
| Surface | `zinc-900/80` with `backdrop-blur-md` |
| Border | `zinc-800` |
| Accent | `orange-600` `#ea580c` |
| Heading | `zinc-100` |
| Subtext | `zinc-400` |
| Danger | `red-500` |
| Warn | `amber-500` |
| Safe | `emerald-500` |

### Hidden UI Strategy
- **Main viewport**: AnatomicalBody3D fills 100% of screen. Zero other UI elements visible.
- **Organ hover**: subtle tooltip label (`Html` from drei)
- **Organ click → OrganPopover**: fixed-position glass card at `(clientX, clientY)` with:
  - `Activity` icon — Risk % + colored progress bar
  - `Dna` icon — Active mutation badges (KRAS, TP53, etc.)
  - `Layers` icon — Body system tag
  - `TrendingUp` icon — Projected risk after 12 months
- **Patient config FAB**: `FlaskConical` icon, bottom-left, opens slide-in GenomicDrawer
- **Auth**: top-right fixed, always-on glass pill

### Implementation Checklist
- [x] Document architecture
- [ ] Rewrite `layout.tsx` — minimal shell
- [ ] Create `BodyDashboard.tsx` — full orchestrator
- [ ] Create `OrganPopover.tsx` — glass popover at click coords  
- [ ] Modify `AnatomicalBody3D.tsx` — add `onOrganSelect` prop, wire markers, remove internal sidebar
- [ ] Rewrite `viewer/page.tsx` — one line: `<BodyDashboard />`
- [ ] Build verify

### 🎨 Exact Design System (from claudehacksosu.com CSS bundle)
- **Background**: `#0a0a0a` deep dark (adapted from their `#faf9f5` cream — we keep dark for medical)
- **Accent Primary**: `#d97757` warm coral-orange gradient → we adapt to `#3b82f6` blue accents for clinical safety
- **Glass morphism**: `.glass` = `backdrop-blur-md` + `bg-zinc-900/70` + `border border-zinc-800/60`
- **Typography**: **Space Grotesk** (headings via `font-display`) + **Inter** (body) + **JetBrains Mono** (data/code)
- **Gradient accent**: `linear-gradient(135deg, #d97757, #c15f3c)` → `linear-gradient(135deg, #3b82f6, #6366f1)`
- **Shimmer button effect**: pseudo-element sweep animation on CTAs
- **Noise texture overlay**: subtle fixed noise `opacity: 0.012` for premium depth
- **Radial mesh gradient** background: `radial-gradient(ellipse, accent-color 0, transparent 60%)`

### 🏗️ Declutter Strategy
- **Hide GenomicLab** behind a floating `⚗ Parameters` FAB button (bottom-left of 3D viewport)
- **Hide Timeline** behind a floating `📈 Timeline` FAB button (bottom-right of 3D viewport)
- Both panels slide in as glass overlays, leaving the 3D model as 100% hero
- **PatientHeader**: slim floating pill at top of viewport, not a full card
- **Sidebar**: collapse to icon-only rail (48px) by default

### ✅ Implementation Checklist
- [x] Extract claudehacksosu.com CSS design tokens
- [ ] Add Space Grotesk + JetBrains Mono to globals.css
- [ ] Create floating FAB panel wrapping GenomicLab (slide-in drawer)
- [ ] Create floating FAB panel wrapping TimelinePanel (slide-in drawer)
- [ ] Refactor viewer/page.tsx to full-viewport 3D canvas layout
- [ ] Add shimmer animation to primary action buttons
- [ ] Add mesh radial gradient background to canvas surroundings
- [ ] Slim sidebar to icon-rail
