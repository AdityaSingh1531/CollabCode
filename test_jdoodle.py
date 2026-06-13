import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

JDOODLE_CLIENT_ID = os.environ.get("JDOODLE_CLIENT_ID")
JDOODLE_CLIENT_SECRET = os.environ.get("JDOODLE_CLIENT_SECRET")
JDOODLE_API_URL = "https://api.jdoodle.com/v1/execute"

print(f"Client ID present: {bool(JDOODLE_CLIENT_ID)}")
print(f"Client Secret present: {bool(JDOODLE_CLIENT_SECRET)}")

payload = {
    "clientId": JDOODLE_CLIENT_ID,
    "clientSecret": JDOODLE_CLIENT_SECRET,
    "script": "print(42)",
    "language": "python3",
    "versionIndex": "4"
}

try:
    response = requests.post(JDOODLE_API_URL, json=payload, timeout=10)
    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())
except Exception as e:
    print("Error connecting to JDoodle:", str(e))
