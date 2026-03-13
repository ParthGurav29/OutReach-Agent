import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv()

MODEL_ID = os.getenv("NOVA_MICRO_MODEL_ID")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION")
)


def empty_prospect():
    """
    Ensures a clean schema is always returned
    """
    return {
        "name": None,
        "role": None,
        "location": None,
        "skills": [],
        "recent_work": None,
        "personalisation_hook": None,
        "contact_url": None
    }


async def extract_prospect(result):

    prompt = f"""
You are a lead research assistant.

Extract structured prospect information from the web result.

Return ONLY JSON.

Required schema:

{{
"name": string | null,
"role": string | null,
"location": string | null,
"skills": string[],
"recent_work": string | null,
"personalisation_hook": string | null,
"contact_url": string | null
}}

Rules:
- If data is missing return null
- skills must always be an array
- contact_url should be LinkedIn or website

Web Result:
Title: {result['title']}
Snippet: {result['snippet']}
URL: {result['url']}
"""

    try:

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "maxTokens": 300,
                    "temperature": 0.2
                }
            })
        )

        response_body = json.loads(response["body"].read())

        text_output = response_body["output"]["message"]["content"][0]["text"]

        # Clean markdown formatting
        text_output = text_output.replace("```json", "").replace("```", "").strip()

        data = json.loads(text_output)

        prospect = empty_prospect()

        prospect["name"] = data.get("name")
        prospect["role"] = data.get("role")
        prospect["location"] = data.get("location")
        prospect["skills"] = data.get("skills", [])
        prospect["recent_work"] = data.get("recent_work")
        prospect["personalisation_hook"] = data.get("personalisation_hook")
        prospect["contact_url"] = data.get("contact_url")

        return prospect

    except Exception as e:

        print("\n⚠️ Extraction error:", result["url"])
        print("Reason:", e)

        return empty_prospect()