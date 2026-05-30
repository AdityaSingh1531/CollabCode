"""
CollabCode Cloud Execution Server (JDoodle Backend)
---------------------------------------------------
A Flask HTTP server that receives code payloads from the frontend, validates them,
and delegates execution to the JDoodle Compiler API.

Features:
- CORS support for cross-origin requests
- Proper error handling and validation for languages
- Timeout handling for the JDoodle API
"""

import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()
# Also check parent directory for .env to support monorepo root settings
parent_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(parent_env_path):
    load_dotenv(dotenv_path=parent_env_path)


app = Flask(__name__)
# Enable CORS for all routes so the Next.js frontend can communicate with this backend
CORS(app)

# --- Configuration ---
JDOODLE_CLIENT_ID = os.environ.get("JDOODLE_CLIENT_ID")
JDOODLE_CLIENT_SECRET = os.environ.get("JDOODLE_CLIENT_SECRET")
JDOODLE_API_URL = "https://api.jdoodle.com/v1/execute"

# Request timeout for the JDoodle API call (in seconds)
API_TIMEOUT = 15

# Map of supported languages to JDoodle identifiers and versions
# JDoodle uses specific language codes and version indices.
# Defaults: Python3 (4), C++17 (1), Java (4), NodeJS (4)
SUPPORTED_LANGUAGES = {
    "python3": {"language": "python3", "versionIndex": "4"},
    "cpp17": {"language": "cpp17", "versionIndex": "1"},
    "java": {"language": "java", "versionIndex": "4"},
    "nodejs": {"language": "nodejs", "versionIndex": "4"}
}

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint to verify the server is running."""
    return jsonify({"status": "ok"}), 200

@app.route("/run", methods=["POST"])
def run_code():
    """
    Main endpoint for code execution.
    Expects a JSON payload with 'code' and 'language'.
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload."}), 400

    code = data.get("code", "").strip()
    language_key = data.get("language", "").lower().strip()

    # 1. Validation for empty code
    if not code:
        return jsonify({"error": "No code provided."}), 400

    # 2. Validation for unsupported languages
    if language_key not in SUPPORTED_LANGUAGES:
        supported = ", ".join(SUPPORTED_LANGUAGES.keys())
        return jsonify({
            "error": f"Unsupported language '{language_key}'. Supported languages: {supported}"
        }), 400

    # Ensure JDoodle credentials exist
    if not JDOODLE_CLIENT_ID or not JDOODLE_CLIENT_SECRET:
        return jsonify({
            "error": "Server configuration error: Missing JDoodle API credentials."
        }), 500

    config = SUPPORTED_LANGUAGES[language_key]

    # Prepare payload for JDoodle
    payload = {
        "clientId": JDOODLE_CLIENT_ID,
        "clientSecret": JDOODLE_CLIENT_SECRET,
        "script": code,
        "language": config["language"],
        "versionIndex": config["versionIndex"]
    }

    try:
        # 3. Call JDoodle API with timeout handling
        response = requests.post(JDOODLE_API_URL, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        result = response.json()
        
        # JDoodle returns output in 'output', memory in 'memory', cpuTime in 'cpuTime'
        # Format this to match our frontend expectations
        stdout = result.get("output", "")
        # JDoodle doesn't strictly separate stderr, but it might include error messages in output.
        # If the output indicates compilation error, we can guess the status.
        stderr = ""
        exit_code = result.get("statusCode", 200)
        
        status = "Accepted"
        if "error" in stdout.lower() or "exception" in stdout.lower():
            status = "Runtime/Compilation Error"

        return jsonify({
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
            "status": status,
            "time": result.get("cpuTime", None),
            "memory": result.get("memory", None)
        })

    except requests.exceptions.Timeout:
        # 4. Timeout handling
        return jsonify({
            "error": "Request to execution engine timed out."
        }), 504
    except requests.exceptions.RequestException as e:
        # 5. Proper error handling for other API issues
        return jsonify({
            "error": f"Failed to connect to execution engine: {str(e)}"
        }), 502
    except Exception as e:
        # Catch-all for unexpected server errors
        return jsonify({
            "error": f"An unexpected error occurred: {str(e)}"
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
