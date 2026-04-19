import json
import re
from scripts.copilot_timeline_service import CopilotTimelineService

def test_json_repair():
    service = CopilotTimelineService()
    
    # Cases to test:
    # 1. Missing comma between objects
    # 2. Trailing comma
    # 3. Truncated braces
    
    test_cases = [
        ('{"trajectories": {"BONE": [{"m":0,"r":0.1} {"m":12,"r":0.2}]}, "summary": "test"}', "Missing comma between list objects"),
        ('{"trajectories": {}, "summary": "test",}', "Trailing comma in object"),
        ('{"trajectories": {"BONE": [{"m":0,"r":0.1}]', "Truncated/Missing closing braces")
    ]
    
    print("Starting JSON Repair Unit Tests...")
    for malformed, description in test_cases:
        print(f"\nTesting: {description}")
        print(f"Input: {malformed}")
        try:
            repaired = service._parse_json(malformed)
            print(f"Repaired: {json.dumps(repaired)}")
            if "trajectories" in repaired:
                print("SUCCESS: JSON was repaired and parsed.")
            else:
                print("FAILURE: JSON parsed but schema was wrong.")
        except Exception as e:
            print(f"FAILURE: Parser threw exception: {e}")

if __name__ == "__main__":
    test_json_repair()
