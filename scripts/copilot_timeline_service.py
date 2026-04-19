import json
import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

try:
    from copilot import CopilotClient
    from copilot.session import PermissionHandler
except ModuleNotFoundError:
    CopilotClient = None
    PermissionHandler = None


class TimelinePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: int = Field(..., ge=0, le=120)
    risk: float = Field(..., ge=0.0, le=1.0)


class PatientSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: int = Field(..., ge=0, le=130)
    primary_site: str = Field(..., min_length=1, max_length=80)
    key_mutations: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("primary_site")
    @classmethod
    def normalize_primary_site(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("primary_site cannot be blank.")
        return normalized

    @field_validator("key_mutations")
    @classmethod
    def validate_key_mutations(cls, value: list[str]) -> list[str]:
        sanitized: list[str] = []
        for mutation in value:
            cleaned = mutation.strip()
            if not cleaned:
                raise ValueError("key_mutations cannot contain blank values.")
            sanitized.append(cleaned)
        return sanitized


class TimelineExplainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_summary: PatientSummary
    selected_organ: str = Field(..., min_length=1, max_length=80)
    treatment: str = Field(..., min_length=1, max_length=80)
    timeline_points: list[TimelinePoint] = Field(..., min_length=1, max_length=241)
    active_month: int = Field(..., ge=0, le=120)

    @field_validator("selected_organ", "treatment")
    @classmethod
    def validate_text_fields(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("field cannot be blank.")
        return normalized

    @model_validator(mode="after")
    def validate_timeline(self) -> "TimelineExplainRequest":
        months = [point.month for point in self.timeline_points]
        if months != sorted(months):
            raise ValueError("timeline_points must be sorted by month ascending.")
        if len(months) != len(set(months)):
            raise ValueError("timeline_points cannot contain duplicate month values.")
        if self.active_month not in set(months):
            raise ValueError("active_month must match a month present in timeline_points.")
        return self


class TimelineExplainResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plain_explanation: str = Field(..., min_length=1, max_length=600)
    next_step_suggestion: str = Field(..., min_length=1, max_length=240)
    safety_note: Literal["This is not medical advice."]

    @field_validator("plain_explanation")
    @classmethod
    def validate_sentence_count(cls, value: str) -> str:
        sentence_count = len([sentence for sentence in re.split(r"(?<=[.!?])\s+", value.strip()) if sentence])
        if sentence_count < 1 or sentence_count > 2:
            raise ValueError("plain_explanation must contain 1 to 2 sentences.")
        return value.strip()

    @field_validator("next_step_suggestion")
    @classmethod
    def normalize_next_step(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("next_step_suggestion cannot be blank.")
        return normalized


class CopilotTimelineServiceError(Exception):
    """Base error class for timeline assistant service failures."""


class CopilotServiceConfigurationError(CopilotTimelineServiceError):
    """Raised when the Copilot SDK is not available."""


class CopilotServiceInvocationError(CopilotTimelineServiceError):
    """Raised when the Copilot API call fails."""


class CopilotServiceResponseError(CopilotTimelineServiceError):
    """Raised when Copilot response payload is invalid."""


class CopilotTimelineService:
    def __init__(self, model: str = "gpt-4.1"):
        self.model = model

    async def explain_timeline(self, request: TimelineExplainRequest) -> TimelineExplainResponse:
        if CopilotClient is None or PermissionHandler is None:
            raise CopilotServiceConfigurationError(
                "Copilot SDK is unavailable. Install 'github-copilot-sdk' to enable timeline assistant."
            )

        client = CopilotClient()
        invocation_error: Optional[CopilotServiceInvocationError] = None
        raw_content: Optional[str] = None

        try:
            await client.start()
            session = await client.create_session(
                on_permission_request=PermissionHandler.approve_all,
                model=self.model,
            )
            response = await session.send_and_wait(self._build_prompt(request))
            raw_content = self._extract_response_text(response)
        except Exception as exc:
            invocation_error = CopilotServiceInvocationError(f"Copilot invocation failed: {exc}")
        finally:
            try:
                await client.stop()
            except Exception as stop_exc:
                if invocation_error is None:
                    raise CopilotServiceInvocationError(f"Failed to stop Copilot client: {stop_exc}") from stop_exc

        if invocation_error is not None:
            raise invocation_error
        if raw_content is None:
            raise CopilotServiceResponseError("Copilot returned no assistant content.")

        return self._parse_response(raw_content)

    def _build_prompt(self, request: TimelineExplainRequest) -> str:
        payload = request.model_dump()
        return (
            "You are a timeline explanation assistant for a cancer-risk simulation UI.\n"
            "Use only the provided data. Do not provide diagnosis or treatment advice.\n"
            "Return only valid JSON with exactly these keys:\n"
            "plain_explanation, next_step_suggestion, safety_note\n"
            "Rules:\n"
            "- plain_explanation: 1-2 short sentences in plain language.\n"
            "- next_step_suggestion: one concrete UI action for the user.\n"
            '- safety_note: exactly "This is not medical advice."\n\n'
            "Input payload:\n"
            f"{json.dumps(payload, indent=2)}"
        )

    def _extract_response_text(self, response: Any) -> str:
        data = getattr(response, "data", None)
        if data is None:
            raise CopilotServiceResponseError("Copilot response missing 'data'.")

        content = getattr(data, "content", None)
        if isinstance(content, str):
            stripped = content.strip()
            if not stripped:
                raise CopilotServiceResponseError("Copilot response content was empty.")
            return stripped

        if isinstance(content, list):
            parts: list[str] = []
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    parts.append(str(part["text"]))
                elif hasattr(part, "text"):
                    parts.append(str(getattr(part, "text")))
                else:
                    parts.append(str(part))
            text = "".join(parts).strip()
            if not text:
                raise CopilotServiceResponseError("Copilot response content list was empty.")
            return text

        raise CopilotServiceResponseError("Copilot response content type is unsupported.")

    def _parse_response(self, raw_content: str) -> TimelineExplainResponse:
        json_candidate = self._extract_json_payload(raw_content)
        try:
            payload = json.loads(json_candidate)
        except json.JSONDecodeError as exc:
            raise CopilotServiceResponseError(f"Copilot returned invalid JSON: {exc}") from exc

        try:
            return TimelineExplainResponse.model_validate(payload)
        except ValidationError as exc:
            raise CopilotServiceResponseError(f"Copilot response schema validation failed: {exc}") from exc

    def _extract_json_payload(self, raw_content: str) -> str:
        stripped = raw_content.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            return stripped

        match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
        if not match:
            raise CopilotServiceResponseError("Copilot response did not include a JSON object.")
        return match.group(0)
