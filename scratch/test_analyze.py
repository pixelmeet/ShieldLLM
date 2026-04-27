import requests
import json

url = "http://localhost:5000/analyze"
payload = {
    "userText": "Hello, how are you?",
    "intentGraph": {"goal": "chat", "allowed": [], "forbidden": [], "history": []},
    "defenseMode": "active",
    "policy": {
        "divergenceThresholds": {"low": 10, "medium": 30, "high": 60, "critical": 85}
    },
    "modelType": "groq"
}

print(f"Sending request to {url}...")
try:
    response = requests.post(url, json=payload, timeout=60)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
