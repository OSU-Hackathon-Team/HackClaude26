# Timeline Tasks (Detailed, Non-Medical-Friendly)

## Purpose
Build a timeline experience that explains cancer risk changes in plain language for non-medical users, while keeping the simulation technically accurate and interactive.

## Current Codebase Reality (What Already Exists)
| Area | Current Status | Files |
|---|---|---|
| Timeline API | Backend endpoint exists at `POST /predict/timeline` with treatment-based exponential decay. | `scripts/api_service.py` |
| Local fallback timeline | Frontend can generate local projection immediately (before backend returns). | `oncopath-next/lib/timeline.ts` |
| Timeline visualization UI | Full timeline chart/panel and drawer components exist. | `oncopath-next/components/TimelinePanel.tsx`, `oncopath-next/components/ui/TimelineDrawer.tsx` |
| Dashboard wiring | 12-month projection is shown in organ popover, but full timeline drawer is not mounted in `BodyDashboard`. | `oncopath-next/components/BodyDashboard.tsx` |
| Claude SDK integration | Not implemented yet. | N/A |
| MCP animation control | Not implemented yet. | N/A |
| End-to-end test capability | Agent has Playwright MCP server access and should actively test every shipped timeline feature in-browser. | Playwright MCP tooling |
| Contract docs | Outdated (`/simulate/temporal` listed; actual endpoint is `/predict/timeline`). | `contracts.md` |
| Tumor assets | Added to frontend public assets. | `oncopath-next/public/models/tumor.obj`, `oncopath-next/public/models/cancerous-blood-cell.obj` |

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

### Phase 4 - UX and Reliability Improvements
1. Add playhead autoplay for timeline (`Play`, `Pause`, `Replay`).
2. Add "compare two treatments" split chart mode.
3. Add optimistic loading text while backend/Claude responses are pending.
4. Add guardrails:
   - if backend fails, keep local projection and show clear message
   - if Claude fails, keep deterministic fallback explanation template
5. Track product metrics:
   - time to first explanation
   - percentage of sessions using timeline controls
   - drop-off point in timeline interaction

### Phase 5 - Active Feature Testing with Playwright MCP (Required)
1. Treat Playwright MCP as mandatory for acceptance testing, not optional.
2. For each feature, run live browser checks:
   - organ selection updates chart
   - treatment changes projection
   - month slider updates playhead and explanation
3. Add scripted Playwright smoke flow for every PR touching timeline/chat/animation.
4. Record failures with exact repro steps and block release until fixed.
5. Keep a regression checklist so previously fixed bugs are re-tested each iteration.

### Phase 6 - Claude SDK Walkthrough Assistant (Required, Final Integration)
1. Implement backend Claude service (new file suggested: `scripts/claude_timeline_service.py`) using Anthropic SDK.
2. Build a prompt template that receives:
   - patient summary (age, primary site, key mutations)
   - selected organ
   - treatment
   - timeline points (month/risk)
   - active month
3. Require output JSON schema:
   - `plain_explanation` (1-2 sentences)
   - `next_step_suggestion` (action user can take in UI)
   - `safety_note` ("This is not medical advice.")
4. Add endpoint in FastAPI (suggested):
   - `POST /assistant/timeline-explain`
5. Add frontend panel (suggested component: `TimelineAssistantPanel.tsx`) that:
   - refreshes explanation when month/treatment/organ changes
   - displays simple narrative + suggested next control action

### Phase 7 - MCP Server for Chatbot-Controlled Animation (Required, Final Integration)
1. Implement MCP server for timeline controls (suggested file: `scripts/mcp_timeline_server.py`).
2. Expose tool actions:
   - `set_treatment`
   - `set_month`
   - `play_timeline`
   - `pause_timeline`
   - `focus_organ`
3. Define strict parameter schema for each tool call (range checks and enum validation).
4. Connect Claude tool-use flow to MCP:
   - Claude decides action -> MCP tool call -> frontend animation update.
5. In frontend, add command bridge (suggested: `oncopath-next/lib/timelineCommands.ts`) to apply MCP actions to UI state.
6. Add user-visible action log:
   - "Claude set month to 12"
   - "Claude switched treatment to Immunotherapy"
7. Final Playwright validation for this phase must include:
   - Claude explanation panel refreshes on state change
   - MCP chatbot commands move animation state (`set_month`, `play_timeline`, etc.)

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
- [ ] Wire `TimelineDrawer` into `BodyDashboard`
- [ ] Update `contracts.md` timeline section to `/predict/timeline`
- [ ] Add non-medical explanation card + glossary
- [ ] Add micro-scene using tumor + blood cell models
- [ ] Actively test all timeline/chat/animation features with Playwright MCP before completion
- [ ] Build Claude SDK timeline explanation endpoint (final integration phase)
- [ ] Build MCP server for animation control (final integration phase)
- [ ] Add chat-controlled timeline actions (play, pause, month jump, treatment switch)
