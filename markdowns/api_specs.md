# API Specification (Draft): OncoPath "What-If" Engine

The OncoPath API is built with **FastAPI** to provide real-time metastatic risk simulations based on hypothetical patient profiles.

## Endpoint: `POST /predict`

### Request Body (JSON)
```json
{
  "age_at_sequencing": 62,
  "sex": "Female",
  "primary_site": "Lung",
  "oncotree_code": "LUAD",
  "genomic_markers": {
    "tp53": 1,
    "kras": 0,
    "egfr": 1,
    "msi_score": 1.2,
    "tmb": 5.4,
    "fga": 0.35
  }
}
```

### Response Body (JSON)
```json
{
  "prediction_id": "uuid-1234",
  "status": "success",
  "risk_scores": {
    "liver": 0.45,
    "lung": 0.12,
    "bone": 0.38,
    "brain": 0.05
  },
  "confidence_metrics": {
    "standard_deviation": 0.03,
    "calibration_score": 0.92
  },
  "shap_values": {
    "egfr_positive": 0.15,
    "age_62": -0.02,
    "luad_histology": 0.08
  }
}
```

## Explainability Layer
The `shap_values` object in the response body will power the frontend visualization (e.g., force plots or waterfall charts), showing the user which features contributed most to the calculated risk for the selected organ.

---

> [!WARNING]
> This API is a research sandbox tool. All requests must be treated as simulated "What-If" scenarios and not as clinical commands.
