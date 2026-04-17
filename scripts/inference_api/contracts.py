from __future__ import annotations

from typing import Dict, Literal

from pydantic import BaseModel, Field


class PatientProfile(BaseModel):
    age: float = Field(..., ge=0)
    sex: str = Field(..., min_length=1)
    primary_site: str = Field(..., min_length=1)
    oncotree_code: str = Field(..., min_length=1)
    mutations: Dict[str, int] = Field(default_factory=dict)


class SimulationResponse(BaseModel):
    patient_age: float
    primary_site: str
    simulated_risks: Dict[str, float]


class ApiError(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    detail: ApiError


class ServiceStatusResponse(BaseModel):
    status: Literal["online"]
    model_count: int
    models_loaded: list[str]
