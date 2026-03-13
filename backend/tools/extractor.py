import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv()

MODEL_ID = os.getenv("NOVA_MICRO_MODEL_ID")
AWS_REGION = os.getenv("AWS_REGION")

client = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION
)


# ---------------------------------------------------
# MODEL CALL
# ---------------------------------------------------

def call_model(prompt: str):

    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 600,
            "temperature": 0.2
        }
    }

    try:

        response = client.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(body)
        )

        raw = json.loads(response["body"].read())

        text = raw["output"]["message"]["content"][0]["text"].strip()

        # remove markdown fences if model returns ```json
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        return text.strip()

    except Exception as e:

        print("⚠️ Model call failed:", e)
        return None


# ---------------------------------------------------
# PROSPECT EXTRACTION
# ---------------------------------------------------

async def extract_prospect(search_result: dict):

    title = search_result.get("title")
    url = search_result.get("url")
    snippet = search_result.get("snippet")

    prompt = f"""
You are a data extraction system.

Extract the professional profile from the search result.

Return ONLY JSON.

Search Result:

Title: {title}
Snippet: {snippet}
URL: {url}

Return JSON format:

{{
"name": "",
"role": "",
"location": "",
"skills": [],
"recent_work": "",
"personalisation_hook": "",
"contact_url": ""
}}

Rules:

- If information is unknown return null
- name should be the person's full name
- role should be their job title
- personalisation_hook should be one sentence useful for outreach
- contact_url should be the LinkedIn profile URL
"""

    try:

        response = call_model(prompt)

        if not response:
            return None

        prospect = json.loads(response)

        # ensure required fields exist
        prospect.setdefault("name", None)
        prospect.setdefault("role", None)
        prospect.setdefault("location", None)
        prospect.setdefault("skills", [])
        prospect.setdefault("recent_work", None)
        prospect.setdefault("personalisation_hook", None)
        prospect.setdefault("contact_url", url)

        return prospect

    except Exception as e:

        print("⚠️ Extraction failed:", e)
        return None