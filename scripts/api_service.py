"""
Compatibility entrypoint for the OncoPath FastAPI inference service.

Run:
    python scripts/api_service.py
"""

from inference_api.app import app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
