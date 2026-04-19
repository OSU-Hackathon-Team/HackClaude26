#!/usr/bin/env python3
"""
MCP timeline command backend with strict validation.

Usage examples:
  # Single request mode
  python scripts/mcp_timeline_server.py \
    --request '{"tool":"set_month","arguments":{"month":12}}'

  # CLI tool mode
  python scripts/mcp_timeline_server.py \
    --tool set_treatment --arguments '{"treatment":"IMMUNOTHERAPY"}'

  # Stdin/server mode (one JSON request per line)
  echo '{"tool":"focus_organ","arguments":{"organ_key":"DMETS_DX_LIVER"}}' \
    | python scripts/mcp_timeline_server.py --stdin
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TextIO


TREATMENTS = (
    "CHEMOTHERAPY",
    "IMMUNOTHERAPY",
    "TARGETED_THERAPY",
    "RADIATION",
    "OBSERVATION",
)

PLAYBACK_MIN_SPEED = 0.1
PLAYBACK_MAX_SPEED = 4.0
PLAYBACK_MIN_CYCLE_COUNT = 1
PLAYBACK_MAX_CYCLE_COUNT = 100

SUPPORTED_TOOLS = (
    "set_treatment",
    "set_month",
    "play_timeline",
    "pause_timeline",
    "focus_organ",
)

FALLBACK_ORGAN_KEYS = {
    "DMETS_DX_ADRENAL_GLAND",
    "DMETS_DX_BILIARY_TRACT",
    "DMETS_DX_BLADDER_UT",
    "DMETS_DX_BONE",
    "DMETS_DX_BOWEL",
    "DMETS_DX_BREAST",
    "DMETS_DX_CNS_BRAIN",
    "DMETS_DX_DIST_LN",
    "DMETS_DX_FEMALE_GENITAL",
    "DMETS_DX_HEAD_NECK",
    "DMETS_DX_INTRA_ABDOMINAL",
    "DMETS_DX_KIDNEY",
    "DMETS_DX_LIVER",
    "DMETS_DX_LUNG",
    "DMETS_DX_MALE_GENITAL",
    "DMETS_DX_MEDIASTINUM",
    "DMETS_DX_OVARY",
    "DMETS_DX_PLEURA",
    "DMETS_DX_PNS",
    "DMETS_DX_SKIN",
    "DMETS_DX_UNSPECIFIED",
    "SYS_ARTERIES",
    "SYS_HEART",
    "SYS_MUSCLES",
    "SYS_SPINAL_NERVES",
    "SYS_VEINS",
}


def _json_line(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


@dataclass
class ValidationIssue(Exception):
    code: str
    message: str
    details: dict[str, Any]


class TimelineCommandServer:
    def __init__(self, month_min: int = 0, month_max: int = 24):
        if month_min > month_max:
            raise ValidationIssue(
                code="CONFIG_ERROR",
                message="Invalid month bounds configuration.",
                details={
                    "month_min": month_min,
                    "month_max": month_max,
                    "constraint": "month_min must be <= month_max",
                },
            )
        self.month_min = month_min
        self.month_max = month_max
        self.known_organ_keys = self._load_known_organ_keys()

    def _load_known_organ_keys(self) -> set[str]:
        repo_root = Path(__file__).resolve().parents[1]
        keys = set(FALLBACK_ORGAN_KEYS)

        anatomy_json = repo_root / "data" / "anatomy_mapping.json"
        if anatomy_json.exists():
            try:
                data = json.loads(anatomy_json.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    for key in data.keys():
                        if isinstance(key, str):
                            keys.add(key.strip().upper())
            except json.JSONDecodeError:
                pass

        anatomy_3d_ts = repo_root / "oncopath-next" / "lib" / "anatomy3d.ts"
        if anatomy_3d_ts.exists():
            try:
                source = anatomy_3d_ts.read_text(encoding="utf-8")
                for key in re.findall(r'"((?:DMETS_DX|SYS)_[A-Z0-9_]+)"\s*:', source):
                    keys.add(key.strip().upper())
            except OSError:
                pass

        return keys

    def process(self, payload: Any) -> dict[str, Any]:
        request_id: str | int | None = None
        if isinstance(payload, dict):
            maybe_id = payload.get("request_id")
            if maybe_id is not None and isinstance(maybe_id, (str, int)):
                request_id = maybe_id

        try:
            request = self._validate_request(payload)
            tool_name = request["tool"]
            arguments = request["arguments"]
            result = self._dispatch(tool_name, arguments)
            response = {"ok": True, "tool": tool_name, "result": result}
            if request_id is not None:
                response["request_id"] = request_id
            return response
        except ValidationIssue as issue:
            response = {
                "ok": False,
                "error": {
                    "code": issue.code,
                    "message": issue.message,
                    "details": issue.details,
                },
            }
            if request_id is not None:
                response["request_id"] = request_id
            return response

    def _validate_request(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Request payload must be a JSON object.",
                details={"received_type": type(payload).__name__},
            )

        allowed_top_level = {"tool", "arguments", "request_id"}
        extra_top_level = sorted(set(payload.keys()) - allowed_top_level)
        if extra_top_level:
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Request contains unsupported top-level fields.",
                details={"extra_fields": extra_top_level},
            )

        if "tool" not in payload:
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Missing required field 'tool'.",
                details={"required_field": "tool"},
            )

        tool_name = payload["tool"]
        if not isinstance(tool_name, str):
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Field 'tool' must be a string.",
                details={"received_type": type(tool_name).__name__},
            )
        tool_name = tool_name.strip()
        if tool_name not in SUPPORTED_TOOLS:
            raise ValidationIssue(
                code="UNKNOWN_TOOL",
                message=f"Unsupported tool '{tool_name}'.",
                details={"supported_tools": list(SUPPORTED_TOOLS)},
            )

        arguments = payload.get("arguments", {})
        if arguments is None:
            arguments = {}
        if not isinstance(arguments, dict):
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Field 'arguments' must be a JSON object.",
                details={"received_type": type(arguments).__name__},
            )

        request_id = payload.get("request_id")
        if request_id is not None and (isinstance(request_id, bool) or not isinstance(request_id, (str, int))):
            raise ValidationIssue(
                code="INVALID_REQUEST",
                message="Field 'request_id' must be a string or integer when provided.",
                details={"received_type": type(request_id).__name__},
            )

        return {"tool": tool_name, "arguments": arguments, "request_id": request_id}

    def _dispatch(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if tool_name == "set_treatment":
            return self._set_treatment(arguments)
        if tool_name == "set_month":
            return self._set_month(arguments)
        if tool_name == "play_timeline":
            return self._play_timeline(arguments)
        if tool_name == "pause_timeline":
            return self._pause_timeline(arguments)
        if tool_name == "focus_organ":
            return self._focus_organ(arguments)
        raise ValidationIssue(
            code="UNKNOWN_TOOL",
            message=f"Unsupported tool '{tool_name}'.",
            details={"supported_tools": list(SUPPORTED_TOOLS)},
        )

    def _set_treatment(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self._validate_argument_keys(arguments, required={"treatment"}, optional=set())
        raw_treatment = arguments["treatment"]
        if not isinstance(raw_treatment, str):
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Field 'treatment' must be a string.",
                details={"field": "arguments.treatment", "received_type": type(raw_treatment).__name__},
            )
        treatment = raw_treatment.strip().upper()
        if treatment not in TREATMENTS:
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Invalid treatment value.",
                details={"field": "arguments.treatment", "allowed_values": list(TREATMENTS)},
            )
        return {"command": "set_treatment", "treatment": treatment}

    def _set_month(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self._validate_argument_keys(arguments, required={"month"}, optional=set())
        month = self._strict_int(arguments["month"], "arguments.month")
        if month < self.month_min or month > self.month_max:
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Month is outside the configured range.",
                details={
                    "field": "arguments.month",
                    "min": self.month_min,
                    "max": self.month_max,
                    "received": month,
                },
            )
        return {"command": "set_month", "month": month}

    def _play_timeline(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self._validate_argument_keys(arguments, required=set(), optional={"speed", "cycle_count"})

        speed = 1.0
        if "speed" in arguments:
            speed = self._strict_number(arguments["speed"], "arguments.speed")
            if speed < PLAYBACK_MIN_SPEED or speed > PLAYBACK_MAX_SPEED:
                raise ValidationIssue(
                    code="VALIDATION_ERROR",
                    message="Playback speed is outside supported bounds.",
                    details={
                        "field": "arguments.speed",
                        "min": PLAYBACK_MIN_SPEED,
                        "max": PLAYBACK_MAX_SPEED,
                        "received": speed,
                    },
                )

        cycle_count: int | None = None
        if "cycle_count" in arguments:
            cycle_count = self._strict_int(arguments["cycle_count"], "arguments.cycle_count")
            if cycle_count < PLAYBACK_MIN_CYCLE_COUNT or cycle_count > PLAYBACK_MAX_CYCLE_COUNT:
                raise ValidationIssue(
                    code="VALIDATION_ERROR",
                    message="Cycle count is outside supported bounds.",
                    details={
                        "field": "arguments.cycle_count",
                        "min": PLAYBACK_MIN_CYCLE_COUNT,
                        "max": PLAYBACK_MAX_CYCLE_COUNT,
                        "received": cycle_count,
                    },
                )

        return {"command": "play_timeline", "speed": speed, "cycle_count": cycle_count}

    def _pause_timeline(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self._validate_argument_keys(arguments, required=set(), optional=set())
        return {"command": "pause_timeline"}

    def _focus_organ(self, arguments: dict[str, Any]) -> dict[str, Any]:
        self._validate_argument_keys(arguments, required={"organ_key"}, optional=set())
        raw_organ_key = arguments["organ_key"]
        if not isinstance(raw_organ_key, str):
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Field 'organ_key' must be a string.",
                details={"field": "arguments.organ_key", "received_type": type(raw_organ_key).__name__},
            )
        organ_key = raw_organ_key.strip().upper()
        if organ_key not in self.known_organ_keys:
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Unknown organ key.",
                details={
                    "field": "arguments.organ_key",
                    "received": organ_key,
                    "supported_prefixes": ["DMETS_DX_", "SYS_"],
                    "supported_count": len(self.known_organ_keys),
                    "supported_sample": sorted(self.known_organ_keys)[:15],
                },
            )
        return {"command": "focus_organ", "organ_key": organ_key}

    @staticmethod
    def _validate_argument_keys(
        arguments: dict[str, Any], required: set[str], optional: set[str]
    ) -> None:
        allowed = required | optional
        missing = sorted(required - set(arguments.keys()))
        extra = sorted(set(arguments.keys()) - allowed)
        if missing or extra:
            details: dict[str, Any] = {"allowed_fields": sorted(allowed)}
            if missing:
                details["missing_fields"] = missing
            if extra:
                details["extra_fields"] = extra
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message="Tool arguments failed schema validation.",
                details=details,
            )

    @staticmethod
    def _strict_int(value: Any, field_path: str) -> int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message=f"Field '{field_path}' must be an integer.",
                details={"field": field_path, "received_type": type(value).__name__},
            )
        return value

    @staticmethod
    def _strict_number(value: Any, field_path: str) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message=f"Field '{field_path}' must be numeric.",
                details={"field": field_path, "received_type": type(value).__name__},
            )
        numeric = float(value)
        if not math.isfinite(numeric):
            raise ValidationIssue(
                code="VALIDATION_ERROR",
                message=f"Field '{field_path}' must be finite.",
                details={"field": field_path, "received": value},
            )
        return numeric


def _load_json_argument(raw: str, flag_name: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValidationIssue(
            code="INVALID_JSON",
            message=f"Flag '{flag_name}' is not valid JSON.",
            details={"flag": flag_name, "error": str(exc)},
        ) from exc


def _run_stdio(server: TimelineCommandServer, input_stream: TextIO, output_stream: TextIO) -> int:
    for line_no, line in enumerate(input_stream, start=1):
        candidate = line.strip()
        if not candidate:
            continue
        try:
            payload = json.loads(candidate)
            response = server.process(payload)
        except json.JSONDecodeError as exc:
            response = {
                "ok": False,
                "error": {
                    "code": "INVALID_JSON",
                    "message": "Input line is not valid JSON.",
                    "details": {"line": line_no, "error": str(exc)},
                },
            }
        output_stream.write(_json_line(response) + "\n")
        output_stream.flush()
    return 0


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def main() -> int:
    parser = argparse.ArgumentParser(description="Strict MCP timeline command backend")
    parser.add_argument("--stdin", action="store_true", help="Read newline-delimited JSON requests from stdin.")
    parser.add_argument("--request", type=str, help="Single JSON request object.")
    parser.add_argument("--tool", choices=SUPPORTED_TOOLS, help="Tool for single request mode.")
    parser.add_argument("--arguments", type=str, default="{}", help="JSON object of tool arguments.")
    parser.add_argument("--month-min", type=int, default=_env_int("MCP_TIMELINE_MONTH_MIN", 0))
    parser.add_argument("--month-max", type=int, default=_env_int("MCP_TIMELINE_MONTH_MAX", 24))
    args = parser.parse_args()

    mode_count = sum([bool(args.stdin), bool(args.request), bool(args.tool)])
    if mode_count != 1:
        sys.stdout.write(
            _json_line(
                {
                    "ok": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "Choose exactly one mode: --stdin, --request, or --tool.",
                        "details": {"modes_selected": mode_count},
                    },
                }
            )
            + "\n"
        )
        return 2

    try:
        server = TimelineCommandServer(month_min=args.month_min, month_max=args.month_max)
    except ValidationIssue as issue:
        sys.stdout.write(
            _json_line(
                {"ok": False, "error": {"code": issue.code, "message": issue.message, "details": issue.details}}
            )
            + "\n"
        )
        return 2

    try:
        if args.stdin:
            return _run_stdio(server, sys.stdin, sys.stdout)

        if args.request:
            payload = _load_json_argument(args.request, "--request")
        else:
            payload = {
                "tool": args.tool,
                "arguments": _load_json_argument(args.arguments, "--arguments"),
            }

        response = server.process(payload)
        sys.stdout.write(_json_line(response) + "\n")
        return 0 if response.get("ok") else 1
    except ValidationIssue as issue:
        sys.stdout.write(
            _json_line(
                {"ok": False, "error": {"code": issue.code, "message": issue.message, "details": issue.details}}
            )
            + "\n"
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
