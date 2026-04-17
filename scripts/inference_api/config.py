from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_DIR = PROJECT_ROOT / "models"
DEFAULT_CORS_ORIGINS = ("http://localhost:3000",)


@dataclass(frozen=True)
class Settings:
    model_dir: Path
    cors_origins: tuple[str, ...]


def _resolve_model_dir(raw_path: str | None) -> Path:
    configured = Path(raw_path) if raw_path else DEFAULT_MODEL_DIR
    if configured.is_absolute():
        return configured
    return (PROJECT_ROOT / configured).resolve()


def _parse_cors_origins(raw_origins: str | None) -> tuple[str, ...]:
    if not raw_origins:
        return DEFAULT_CORS_ORIGINS

    origins = tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ORIGINS


def load_settings() -> Settings:
    return Settings(
        model_dir=_resolve_model_dir(os.getenv("ONCOPATH_MODEL_DIR")),
        cors_origins=_parse_cors_origins(os.getenv("ONCOPATH_CORS_ORIGINS")),
    )
