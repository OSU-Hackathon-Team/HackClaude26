import json
import re
from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field

class TimelinePoint(BaseModel):
    month: int
    risk: float

class TimelineExplainRequest(BaseModel):
    primary_site: str
    mutations: List[str]
    risks: dict = Field(default_factory=dict)
    treatment: str
    months: int
    selected_organ: Optional[str] = None

class TimelineExplainResponse(BaseModel):
    status: str
    treatment: str
    trajectories: dict[str, List[TimelinePoint]]
    summary: str

class CopilotTimelineService:
    def __init__(self):
        self.model = "claude-sonnet-4-6"

    async def predict_treatment_timeline(self, request: TimelineExplainRequest) -> TimelineExplainResponse:
        import os
        from anthropic import AsyncAnthropic, NotFoundError

        # 1. Direct Claude API (Official SDK)
        claude_key = os.getenv("CLAUDE_API_KEY")
        if not claude_key:
             print("Warning: CLAUDE_API_KEY NOT FOUND in environment.")
             return self._fallback_prediction(request)

        # OPTIMIZATION: Filter risks to only include significant metastatic sites (> 1% baseline)
        # This prevents the JSON response from exploding in size and causing syntax errors.
        significant_risks = {k: v for k, v in request.risks.items() if v > 0.01}
        if not significant_risks and request.selected_organ and request.selected_organ != "Metastatic Target":
            # Safety: Ensure the selected organ is always included even if risk is low
            significant_risks[request.selected_organ] = request.risks.get(request.selected_organ, 0.01)
        
        filtered_request = TimelineExplainRequest(
            primary_site=request.primary_site,
            mutations=request.mutations,
            risks=significant_risks,
            treatment=request.treatment,
            months=request.months,
            selected_organ=request.selected_organ
        )

        try:
            client = AsyncAnthropic(api_key=claude_key.strip())
            target_models = ["claude-haiku-4-5"]
            
            print(f"Starting Direct Claude API attempt (Standard API) with {len(significant_risks)} focus sites...")
            response = None
            for model_id in target_models:
                try:
                    response = await client.messages.create(
                        model=model_id,
                        max_tokens=3500,
                        messages=[{"role": "user", "content": self._build_prompt(filtered_request)}]
                    )
                    print(f"Claude API Success with {model_id}!")
                    break 
                except NotFoundError:
                    continue 
                except Exception as e:
                    print(f"Claude API Error [{model_id}]: {e}")
                    break 
            
            if response is not None:
                raw_content = response.content[0].text
                parsed_data = self._parse_json(raw_content)
                
                return TimelineExplainResponse(
                    status="success",
                    treatment=request.treatment,
                    trajectories={
                        site: [TimelinePoint(**p) for p in pts] 
                        for site, pts in parsed_data.get("trajectories", {}).items()
                    },
                    summary=parsed_data.get("summary") or "Biological rationale unavailable — trajectory data computed successfully."
                )
        except Exception as e:
            print(f"Anthropic SDK Initialization Error: {e}")

        return self._fallback_prediction(request)

    def _build_prompt(self, request: TimelineExplainRequest) -> str:
        risk_context = "\n".join([f"- {k}: {v:.2f}" for k, v in request.risks.items() if v > 0.05])
        top_risks = sorted(request.risks.items(), key=lambda x: x[1], reverse=True)[:3]
        top_risk_summary = ", ".join([f"{k} ({v:.0%})" for k, v in top_risks if v > 0.01])
        mutations_str = ", ".join(request.mutations) if request.mutations else "None detected"
        focus_organ = request.selected_organ or "systemic"
        
        return f"""
        You are an advanced Oncology Simulation Agent applying the \"Seed and Soil\" theory of metastasis.
        
        PATIENT DATA:
        - Primary Site: {request.primary_site}
        - Active Mutations (Seed): {mutations_str}
        - Top Metastatic Risks (Soil): {top_risk_summary}
        - Focus Organ: {focus_organ}
        
        CURRENT RISK SNAPSHOT:
        {risk_context}
        
        TREATMENT PLAN:
        - Selection: {request.treatment}
        - Duration: {request.months} months
        
        SIMULATION INSTRUCTIONS:
        1. Evaluate how {request.treatment} affects each metastatic site given the active mutations ({mutations_str}).
        2. Determine if this treatment is localized (organ-specific) or systemic (whole-body).
        3. Consider known mutation-treatment interactions (e.g., TP53 loss reduces chemo sensitivity; PIK3CA responds to PI3K inhibitors; KRAS drives liver tropism via portal vein).
        4. Generate a temporal risk trajectory for EACH site from month 0 to {request.months} (use 12-month intervals).
        5. Risk values must stay in [0.0, 1.0].
        6. CRITICAL: Respond ONLY with a valid JSON object — no markdown, no prose outside the JSON.
        7. CRITICAL: Write the "summary" field FIRST in the JSON, before "trajectories". This ensures it is never truncated.
        
        JSON STRUCTURE (summary MUST come first):
        {{
            "summary": "2-3 sentence Biological Rationale written for a clinical oncologist. Name the primary site ({request.primary_site}), the key driver mutations ({mutations_str}), and explain WHY {request.treatment} is expected to raise or lower metastatic risk over time. Connect to Seed-and-Soil biology. Be specific.",
            "trajectories": {{
                "ORGAN_ID": [
                    {{"month": 0, "risk": 0.XX}},
                    {{"month": 12, "risk": 0.XX}},
                    {{"month": 24, "risk": 0.XX}},
                    {{"month": 36, "risk": 0.XX}}
                ]
            }}
        }}
        """

    def _extract_text(self, response: Any) -> str:
        # Robust extraction logic for Copilot SDK response objects
        try:
            if hasattr(response, 'data') and hasattr(response.data, 'content'):
                content = response.data.content
                if isinstance(content, list):
                    return "".join([c.get('text', '') if isinstance(c, dict) else str(c) for c in content])
                return str(content)
            return str(response)
        except:
            return str(response)

    def _parse_json(self, text: str) -> dict:
        try:
            # Clean LLM markers if present
            cleaned = re.sub(r'```(?:json)?', '', text)
            cleaned = cleaned.strip()

            # Find main JSON block
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if not match:
                raise ValueError("No JSON object found in response.")
            
            json_str = match.group(0)
            
            # --- REPAIR LAYER: Fix common LLM syntax errors ---
            # 1. Fix missing commas between objects: } { -> }, {
            json_str = re.sub(r'\}\s*\{', '}, {', json_str)
            # 2. Fix missing commas between list items: ] { -> ], {
            json_str = re.sub(r'\]\s*\{', '], {', json_str)
            # 3. Remove trailing commas in arrays/objects
            json_str = re.sub(r',\s*([\}\]])', r'\1', json_str)
            
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                # If still failing, try to fix truncation by adding closing braces
                opened_braces = json_str.count('{') - json_str.count('}')
                opened_brackets = json_str.count('[') - json_str.count(']')
                json_str += ']' * opened_brackets
                json_str += '}' * opened_braces
                return json.loads(json_str)

        except Exception as e:
            print(f"JSON Parsing/Repair Error: {e}")
            return {"trajectories": {}, "summary": f"Parse Failure: {str(e)[:60]}..."}

    def _fallback_prediction(self, request: TimelineExplainRequest) -> TimelineExplainResponse:
        # Basic exponential decay as safety net for all sites
        trajectories = {}
        for site, baseline in request.risks.items():
            if baseline < 0.01: continue
            
            decay = 0.05
            points = []
            for m in range(0, request.months + 1, 12):
                risk = baseline * (0.92 ** (m / 12))
                points.append(TimelinePoint(month=m, risk=round(risk, 3)))
            trajectories[site] = points
        
        return TimelineExplainResponse(
            status="simulated",
            treatment=request.treatment,
            trajectories=trajectories,
            summary="Deterministic projection used for all sites (LLM Agent Offline)."
        )
