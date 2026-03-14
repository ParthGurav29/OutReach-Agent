import os
import json
import re
import asyncio
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

CAMPAIGN GOAL:
{goal}

Generate 5 search queries to find REAL PEOPLE to reach out to.

CRITICAL RULES:
1. NEVER use site: operators — they don't work with our search engine.
2. Each query MUST be meaningfully different — different job title, seniority, or angle.
3. No two queries should be variations of the same phrase.
4. Queries should return individual LinkedIn profiles, not job listings.
5. Include "LinkedIn" in each query to bias toward profiles.
6. Adapt queries to the actual goal — don't use generic SaaS/startup queries if the goal is about something else.

BAD queries (too similar, site: operators):
- site:linkedin.com/in HR manager Mumbai
- site:linkedin.com/in HR director Mumbai
- site:linkedin.com/in HR manager IT Mumbai

GOOD queries (diverse angles, natural language):
- HR manager Mumbai IT company LinkedIn profile
- talent acquisition director Mumbai tech startup LinkedIn
- chief people officer Mumbai fintech LinkedIn
- recruitment head Mumbai software company LinkedIn
- CHRO Mumbai India LinkedIn profile

Return ONLY raw JSON. No markdown. No explanation.

{{
  "campaign_plan": {{
    "search_queries": [
      "query 1",
      "query 2",
      "query 3",
      "query 4",
      "query 5"
    ],
    "target_profile": {{
      "role": "...",
      "industry": "...",
      "location": "..."
    }},
    "tone": "friendly and professional"
  }}
}}
"""

    body = {
        "messages": [
            {"role": "user", "content": [{"text": prompt}]}
        ],
        "inferenceConfig": {
            "maxTokens": 600,
            "temperature": 0.4
        }
    }

    loop = asyncio.get_running_loop()

    try:
        response = await loop.run_in_executor(
            None,
            lambda: bedrock.invoke_model(
                modelId=MODEL_ID,
                body=json.dumps(body)
            )
        )

        response_body = json.loads(response["body"].read())
        text_output = response_body["output"]["message"]["content"][0]["text"]

        cleaned = re.sub(r"```json", "", text_output)
        cleaned = re.sub(r"```", "", cleaned)
        cleaned = cleaned.strip()

        plan = json.loads(cleaned)

        if "campaign_plan" not in plan:
            print("⚠️ Planner returned invalid structure")
            return {}

        queries = plan["campaign_plan"].get("search_queries", [])
        print(f"\n📋 Planner generated {len(queries)} queries:")
        for q in queries:
            print(f"   → {q}")

        return plan

    except json.JSONDecodeError:
        print("\n⚠️ Planner JSON parse failed")
        print("Raw output:", text_output)
        return {}

    except Exception as e:
        print(f"\n⚠️ Planner call failed: {e}")
        return {}