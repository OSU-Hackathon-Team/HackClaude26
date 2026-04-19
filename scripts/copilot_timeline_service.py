import json
import re
from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field

try:
    from copilot import CopilotClient
    from copilot.session import PermissionHandler
except (ImportError, ModuleNotFoundError, TypeError):
    CopilotClient = None
    PermissionHandler = None

class TimelinePoint(BaseModel):
    month: int
    risk: float

class TimelineExplainRequest(BaseModel):
    primary_site: str
    mutations: List[str]
    baseline_risk: float
    treatment: str
    months: int
    organ: Optional[str] = "Metastatic Site"

class TimelineExplainResponse(BaseModel):
    status: str
    treatment: str
    timeline: List[TimelinePoint]
    summary: str

class CopilotTimelineService:
    def __init__(self):
        self.model = "gpt-4o" # default model, will try to use Claude 3.5 if available via SDK

    async def predict_treatment_timeline(self, request: TimelineExplainRequest) -> TimelineExplainResponse:
        import httpx
        import os
        
        claude_key = os.getenv("CLAUDE_API_KEY")
        if claude_key:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": claude_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        },
                        json={
                            "model": "claude-3-5-sonnet-20241022",
                            "max_tokens": 2000,
                            "messages": [{"role": "user", "content": self._build_prompt(request)}]
                        }
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    raw_content = data['content'][0]['text']
                    parsed_data = self._parse_json(raw_content)
                    
                    return TimelineExplainResponse(
                        status="success",
                        treatment=request.treatment,
                        timeline=[TimelinePoint(**p) for p in parsed_data.get("timeline", [])],
                        summary=parsed_data.get("summary", "Clinical biological simulation complete.")
                    )
            except Exception as e:
                print(f"Direct Claude API Error: {e}")
                # Fall through to other handlers

        if CopilotClient is None:
            return self._fallback_prediction(request)

        client = CopilotClient()
        try:
            await client.start()
            session = await client.create_session(
                on_permission_request=PermissionHandler.approve_all,
                model="claude-3.5-sonnet"
            )
            
            prompt = self._build_prompt(request)
            response = await session.send_and_wait(prompt)
            
            # Extract content from response
            raw_content = self._extract_text(response)
            parsed_data = self._parse_json(raw_content)
            
            return TimelineExplainResponse(
                status="success",
                treatment=request.treatment,
                timeline=[TimelinePoint(**p) for p in parsed_data.get("timeline", [])],
                summary=parsed_data.get("summary", "Copilot biological simulation complete.")
            )
        except Exception as e:
            print(f"Copilot Service Error: {e}")
            return self._fallback_prediction(request)
        finally:
            await client.stop()
    def _build_prompt(self, request: TimelineExplainRequest) -> str:
        return f"""
        You are an advanced Oncology Simulation Agent. 
        Target: Predict the metastatic risk trajectory for {request.organ} over {request.months} months.
        
        PATIENT DATA:
        - Primary Site: {request.primary_site}
        - Mutations: {", ".join(request.mutations)}
        - Baseline ML Risk (Soil): {request.baseline_risk:.2f}
        
        TREATMENT PLAN:
        - Selection: {request.treatment}
        
        INSTRUCTIONS:
        1. Consider the biological synergy between mutations (Seed) and treatment (e.g. PARP inhibitors for BRCA mutations).
        2. Generate a temporal risk curve from month 0 to {request.months}.
        3. Respond ONLY with a valid JSON object.
        
        JSON STRUCTURE:
        {{
            "timeline": [
                {{"month": 0, "risk": {request.baseline_risk:.2f}}},
                ...
            ],
            "summary": "1-2 sentence biological rationale."
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
            # Find JSON block if Claude adds preamble
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(text)
        except:
            return {"timeline": [], "summary": "Error parsing LLM response."}

    def _fallback_prediction(self, request: TimelineExplainRequest) -> TimelineExplainResponse:
        # Basic exponential decay as safety net
        decay = 0.05
        timeline = []
        for m in range(0, request.months + 1, 6):
            risk = request.baseline_risk * (0.9 ** (m / 6))
            timeline.append(TimelinePoint(month=m, risk=round(risk, 3)))
        
        return TimelineExplainResponse(
            status="simulated",
            treatment=request.treatment,
            timeline=timeline,
            summary="Deterministic projection used (LLM Agent Offline)."
        )
