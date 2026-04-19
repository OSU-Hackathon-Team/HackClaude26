# Timeline Tasks (Detailed, Non-Medical-Friendly)

## Purpose
Build a timeline experience that explains cancer risk changes in plain language for non-medical users, while keeping the simulation technically accurate and interactive.

## Current Codebase Reality (What Already Exists)
| Area | Current Status | Files |
|---|---|---|
| Timeline API | Backend endpoints exist at `POST /predict/timeline` and `POST /assistant/timeline-explain`. | `scripts/api_service.py` |
| Local fallback timeline | Frontend generates immediate local projection and keeps it active if backend fetch fails. | `oncopath-next/lib/timeline.ts`, `oncopath-next/components/BodyDashboard.tsx` |
| Timeline visualization UI | Timeline chart, compare mode, explainability panel, and drawer UI are implemented. | `oncopath-next/components/TimelinePanel.tsx`, `oncopath-next/components/ui/TimelineDrawer.tsx` |
| Dashboard wiring | `BodyDashboard` synchronizes organ/treatment/month state, backend swap, playback controls, scene mode, and timeline bridge state. | `oncopath-next/components/BodyDashboard.tsx` |
| Copilot timeline assistant | Copilot-backed timeline explanation service and assistant panel are implemented with deterministic fallback behavior. | `scripts/copilot_timeline_service.py`, `oncopath-next/components/TimelineAssistantPanel.tsx` |
| MCP animation control | Strict MCP timeline command server and frontend command bridge are implemented (`set_treatment`, `set_month`, `play_timeline`, `pause_timeline`, `focus_organ`). | `scripts/mcp_timeline_server.py`, `oncopath-next/lib/timelineCommands.ts` |
| End-to-end test coverage | Playwright regression tests validate timeline controls, assistant fallback, micro-scene behavior, and MCP command bridge actions. | `oncopath-next/tests/e2e/phase5.timeline-regression.spec.ts` |
| Contract docs | Contracts now cover `/predict/timeline` and `/assistant/timeline-explain` schemas. | `contracts.md` |
| Tumor assets + micro scene | Tumor and blood-cell assets are loaded in micro mode with risk/month-linked animation and user legend. | `oncopath-next/public/models/tumor.obj`, `oncopath-next/public/models/cancerous-blood-cell.obj`, `oncopath-next/components/TumorMicroScene.tsx` |

## Product Rules for Non-Medical Users
1. Always show a plain-English sentence for any numeric change (example: "Risk is dropping steadily with treatment.").
2. Avoid unexplained terms (if a medical term appears, include one-line definition next to it).
3. Prefer "what this means for the patient" over algorithm details.
4. Show uncertainty clearly ("estimate" / "projection"), never as guaranteed outcome.

## Implementation Plan

### Phase 1 - Align API + Contract + Frontend Wiring
1. Update contract docs to match real endpoint (`/predict/timeline`), request shape, and response shape.
2. In `BodyDashboard.tsx`, add timeline state:
   - `selectedOrgan`
   - `selectedTreatment`
   - `selectedMonth`
   - `timelineData`
   - `timelineSource` (`local` or `backend`)
3. Mount `TimelineDrawer` in `BodyDashboard` and connect it to risk/timeline state.
4. Keep local projection as immediate fallback and swap to backend projection when available.
5. Ensure organ selection in popover and timeline drawer stay synchronized.
6. Add explicit UI status badges:
   - "Live projection (backend)"
   - "Instant estimate (local)"

**Status:** ✅ Completed

### Phase 2 - Improve Non-Medical Explainability Layer
1. Add a "What is happening now?" card in `TimelinePanel`:
   - Input: active month point + baseline + treatment
   - Output: one sentence in plain language.
2. Add risk-band labels:
   - 0-19%: Low concern
   - 20-49%: Moderate concern
   - 50%+: High concern
3. Add a short glossary drawer for terms:
   - Metastasis
   - Baseline risk
   - Treatment response
   - Projection horizon
4. Add "Patient-friendly mode" toggle:
   - ON: plain language + fewer technical metrics
   - OFF: include confidence metrics + SHAP snippets

**Status:** ✅ Completed

### Phase 3 - Integrate New 3D Tumor + Blood Cell Models
1. Asset source (already copied):
   - `oncopath-next/public/models/tumor.obj`
   - `oncopath-next/public/models/cancerous-blood-cell.obj`
2. Add a new scene component (suggested: `TumorMicroScene.tsx`) that loads both OBJ models.
3. Add mode switch in dashboard:
   - **Macro mode**: full anatomy body
   - **Micro mode**: tumor + blood cell interaction
4. Link timeline month/risk to micro-scene animation:
   - Higher risk: larger tumor scale, faster blood cell turbulence
   - Lower risk: tumor shrink + lower glow intensity
5. Add a simple legend so non-medical users understand colors and motion.

**Status:** ✅ Completed

### Phase 4 - UX and Reliability Improvements
1. Add playhead autoplay for timeline (`Play`, `Pause`, `Replay`).
2. Add "compare two treatments" split chart mode.
3. Add optimistic loading text while backend/Copilot API responses are pending.
4. Add guardrails:
   - if backend fails, keep local projection and show clear message
   - if Copilot API assistant fails, keep deterministic fallback explanation template
5. Track product metrics:
   - time to first explanation
   - percentage of sessions using timeline controls
   - drop-off point in timeline interaction

**Status:** ✅ Completed

### Phase 5 - Active Feature Testing with Playwright MCP (Required)
1. Treat Playwright MCP as mandatory for acceptance testing, not optional.
2. For each feature, run live browser checks:
   - organ selection updates chart
   - treatment changes projection
   - month slider updates playhead and explanation
3. Add scripted Playwright smoke flow for every PR touching timeline/chat/animation.
4. Record failures with exact repro steps and block release until fixed.
5. Keep a regression checklist so previously fixed bugs are re-tested each iteration.

**Status:** ✅ Completed (scripted Playwright regression suite in `oncopath-next/tests/e2e/phase5.timeline-regression.spec.ts`; latest local run: 6 passed)

### Phase 6 - Copilot API Walkthrough Assistant (Required, Final Integration)
1. Use `/home/mitch/Documents/copilothax/demo_chat.py` + `mcp_server.py` as the integration reference pattern.
2. Implement backend Copilot service (new file suggested: `scripts/copilot_timeline_service.py`) using the Copilot API client.
3. Build a prompt template that receives:
   - patient summary (age, primary site, key mutations)
   - selected organ
   - treatment
   - timeline points (month/risk)
   - active month
4. Require output JSON schema:
   - `plain_explanation` (1-2 sentences)
   - `next_step_suggestion` (action user can take in UI)
   - `safety_note` ("This is not medical advice.")
5. Add endpoint in FastAPI (suggested):
   - `POST /assistant/timeline-explain`
6. Add frontend panel (suggested component: `TimelineAssistantPanel.tsx`) that:
   - refreshes explanation when month/treatment/organ changes
   - displays simple narrative + suggested next control action

**Status:** ✅ Completed (service + endpoint + frontend panel implemented; UI includes deterministic fallback when Copilot endpoint is unavailable)

### Phase 7 - MCP Server for Chatbot-Controlled Animation (Required, Final Integration)
1. Implement MCP server for timeline controls (suggested file: `scripts/mcp_timeline_server.py`).
2. Expose tool actions:
   - `set_treatment`
   - `set_month`
   - `play_timeline`
   - `pause_timeline`
   - `focus_organ`
3. Define strict parameter schema for each tool call (range checks and enum validation).
4. Connect Copilot tool-use flow to MCP:
   - Copilot decides action -> MCP tool call -> frontend animation update.
5. In frontend, add command bridge (suggested: `oncopath-next/lib/timelineCommands.ts`) to apply MCP actions to UI state.
6. Add user-visible action log:
   - "Copilot set month to 12"
   - "Copilot switched treatment to Immunotherapy"
7. Final Playwright validation for this phase must include:
   - Copilot explanation panel refreshes on state change
   - MCP chatbot commands move animation state (`set_month`, `play_timeline`, etc.)

**Status:** ✅ Completed

Example MCP command payload:
```json
{
  "tool": "set_month",
  "arguments": {
    "month": 12
  }
}
```

## Improvement Backlog (After Core Delivery)
1. Add voice narration mode ("Read timeline aloud").
2. Add multilingual explanations for patient/family education.
3. Add confidence ribbon around timeline curve (visual uncertainty band).
4. Add "Why this changed" diff cards between Month N and Month N+1.
5. Add educational onboarding tour for first-time users.

## Delivery Checklist
- [x] Add tumor model asset to frontend public directory
- [x] Add blood-cell model asset to frontend public directory
- [x] Wire `TimelineDrawer` into `BodyDashboard`
- [x] Update `contracts.md` timeline section to `/predict/timeline`
- [x] Add non-medical explanation card + glossary
- [x] Add micro-scene using tumor + blood cell models
- [x] Actively test all timeline/chat/animation features with Playwright MCP before completion
- [x] Build Copilot API timeline explanation endpoint (final integration phase)
- [x] Build MCP server for animation control (final integration phase)
- [x] Add chat-controlled timeline actions (play, pause, month jump, treatment switch)
