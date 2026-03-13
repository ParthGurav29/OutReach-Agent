import os
import json
import re
import boto3
from dotenv import load_dotenv

load_dotenv()

MODEL_ID = os.getenv("NOVA_PRO_MODEL_ID")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION")
)


async def generate_campaign_plan(goal: str, memory_context: str = ""):

    prompt = f"""
    {memory_context}
You are an outreach campaign strategist.

Goal:
{goal}

Create a campaign plan for identifying outreach prospects.

IMPORTANT RULES:

Return ONLY raw JSON.
Do NOT include explanations.
Do NOT include markdown.
Do NOT use ```json blocks.

Structure:

{{
  "campaign_plan": {{
    "search_queries": [],
    "target_profile": {{}},
    "personalisation_angle": {{}},
    "tone": {{}}
  }}
}}

search_queries should contain queries that help find real professionals
like founders, CEOs, or SaaS leaders.

Example queries:

site:linkedin.com/in SaaS founder
site:linkedin.com/in B2B SaaS CEO
site:linkedin.com/in startup founder SaaS
site:linkedin.com/in SaaS product leader
"""

    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 600,
            "temperature": 0.3
        }
    }

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps(body)
    )

    response_body = json.loads(response["body"].read())

    text_output = response_body["output"]["message"]["content"][0]["text"]

    # ------------------------------------
    # Clean markdown formatting if present
    # ------------------------------------

    cleaned = re.sub(r"```json", "", text_output)
    cleaned = re.sub(r"```", "", cleaned)
    cleaned = cleaned.strip()

    # ------------------------------------
    # Parse JSON safely
    # ------------------------------------

    try:

        plan = json.loads(cleaned)

        return plan

    except Exception as e:

        print("\n⚠️ Planner JSON parse failed")
        print("Raw model output:\n")
        print(text_output)

        return {}