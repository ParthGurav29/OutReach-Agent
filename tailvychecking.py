import os
import requests

# Load API key (either from env variable or paste directly)
API_KEY = os.getenv("TAVILY_API_KEY") or "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"

url = "https://api.tavily.com/usage"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()

        print("✅ API Key is valid")
        print("Plan:", data.get("plan"))
        print("Credits Used:", data.get("usage"))
        print("Credits Remaining:", data.get("remaining"))

    elif response.status_code == 401:
        print("❌ Invalid API key")

    else:
        print("⚠️ Unexpected response")
        print("Status:", response.status_code)
        print(response.text)

except Exception as e:
    print("❌ Error connecting to Tavily:", str(e))