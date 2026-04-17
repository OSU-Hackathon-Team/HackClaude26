from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .contracts import PatientProfile, SimulationResponse


@dataclass(frozen=True)
class InferenceArtifacts:
    encoder: Any
    scaler: Any
    genomic_features: list[str]
    models: dict[str, Any]

    @classmethod
    def from_model_dir(cls, model_dir: Path) -> "InferenceArtifacts":
        if not model_dir.is_dir():
            raise FileNotFoundError(f"Model directory not found: {model_dir}")

        required_artifacts = (
            "clinical_encoder.joblib",
            "clinical_scaler.joblib",
            "genomic_features.joblib",
        )
        missing = [name for name in required_artifacts if not (model_dir / name).is_file()]
        if missing:
            missing_msg = ", ".join(missing)
            raise FileNotFoundError(f"Missing required model artifacts in {model_dir}: {missing_msg}")

        model_files = sorted(model_dir.glob("model_*.joblib"))
        if not model_files:
            raise FileNotFoundError(f"No model_*.joblib files found in {model_dir}")

        encoder = joblib.load(model_dir / "clinical_encoder.joblib")
        scaler = joblib.load(model_dir / "clinical_scaler.joblib")
        genomic_features = list(joblib.load(model_dir / "genomic_features.joblib"))
        models = {
            model_file.stem.replace("model_", "").upper(): joblib.load(model_file)
            for model_file in model_files
        }

        return cls(
            encoder=encoder,
            scaler=scaler,
            genomic_features=genomic_features,
            models=models,
        )


class InferenceService:
    def __init__(self, artifacts: InferenceArtifacts) -> None:
        self._artifacts = artifacts

    @property
    def model_keys(self) -> list[str]:
        return sorted(self._artifacts.models.keys())

    def simulate(self, profile: PatientProfile) -> SimulationResponse:
        clinical_row = pd.DataFrame(
            [
                {
                    "AGE_AT_SEQUENCING": profile.age,
                    "SEX": profile.sex,
                    "PRIMARY_SITE": profile.primary_site,
                    "ONCOTREE_CODE": profile.oncotree_code,
                }
            ]
        )

        x_num = self._artifacts.scaler.transform(clinical_row[["AGE_AT_SEQUENCING"]])
        x_cat = self._artifacts.encoder.transform(clinical_row[["SEX", "PRIMARY_SITE", "ONCOTREE_CODE"]])
        if hasattr(x_cat, "toarray"):
            x_cat = x_cat.toarray()

        x_genomic = np.array([self._build_mutation_vector(profile.mutations)], dtype=float)
        features = np.hstack([x_num, x_cat, x_genomic])

        risks: dict[str, float] = {}
        for site, model in self._artifacts.models.items():
            probability = model.predict_proba(features)[0][1]
            risks[site] = float(probability)

        return SimulationResponse(
            patient_age=profile.age,
            primary_site=profile.primary_site,
            simulated_risks=risks,
        )

    def _build_mutation_vector(self, mutations: dict[str, int]) -> list[int]:
        vector: list[int] = []
        for feature in self._artifacts.genomic_features:
            value = mutations.get(feature, 0)
            if value not in (0, 1, True, False):
                raise ValueError(f"Mutation value for '{feature}' must be 0 or 1.")
            vector.append(int(value))
        return vector
