import asyncio
import os
import json
import re
from scripts.copilot_timeline_service import CopilotTimelineService, TimelineExplainRequest
from dotenv import load_dotenv

async def reproduce_parsing_issue():
    load_dotenv()
    service = CopilotTimelineService()
    
    # Simulating the UI state from the screenshot
    # Organ: DIST LN
    req = TimelineExplainRequest(
        primary_site="Breast",
        mutations=["TP53", "PIK3CA"],
        risks={"DMETS_DX_DIST_LN": 0.35, "DMETS_DX_BONE": 0.45},
        treatment="CHEMOTHERAPY",
        months=24,
        selected_organ="DIST LN"
    )
    
    print("Reproducing UI request with 'DIST LN' organ...")
    try:
        # We need to see the raw text from Claude to see why it fails parsing
        # I'll temporarily wrap the internal call or just rely on the prints I added
        result = await service.predict_treatment_timeline(req)
        print(f"Status: {result.status}")
        print(f"Summary: {result.summary}")
        print(f"Trajectories count: {len(result.trajectories)}")
        
        if result.summary == "Error parsing LLM response.":
            print("!!! REPRODUCED: Parsing failure detected.")
    except Exception as e:
        print(f"Production error during reproduction: {e}")

if __name__ == "__main__":
    asyncio.run(reproduce_parsing_issue())
