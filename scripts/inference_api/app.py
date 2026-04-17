from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import load_settings
from .contracts import ErrorResponse, PatientProfile, ServiceStatusResponse, SimulationResponse
from .service import InferenceArtifacts, InferenceService


def create_app() -> FastAPI:
    settings = load_settings()
    artifacts = InferenceArtifacts.from_model_dir(settings.model_dir)
    service = InferenceService(artifacts)

    app = FastAPI(title="OncoPath Risk Simulator API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", response_model=ServiceStatusResponse)
    def read_root() -> ServiceStatusResponse:
        return ServiceStatusResponse(
            status="online",
            model_count=len(service.model_keys),
            models_loaded=service.model_keys,
        )

    @app.get("/health", response_model=ServiceStatusResponse)
    def read_health() -> ServiceStatusResponse:
        return ServiceStatusResponse(
            status="online",
            model_count=len(service.model_keys),
            models_loaded=service.model_keys,
        )

    @app.post(
        "/simulate",
        response_model=SimulationResponse,
        responses={422: {"model": ErrorResponse}},
    )
    def simulate_risk(profile: PatientProfile) -> SimulationResponse:
        try:
            return service.simulate(profile)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail={"code": "invalid_profile", "message": str(exc)},
            ) from exc

    @app.post(
        "/predict",
        response_model=SimulationResponse,
        deprecated=True,
        responses={422: {"model": ErrorResponse}},
    )
    def predict_risk(profile: PatientProfile) -> SimulationResponse:
        return simulate_risk(profile)

    return app


app = create_app()
