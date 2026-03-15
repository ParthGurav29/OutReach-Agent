import os
import json
import asyncio
import boto3
from dotenv import load_dotenv

load_dotenv()

MODEL_ID = os.getenv("NOVA_MICRO_MODEL_ID")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION")
)


async def score_prospect(goal: str, prospect: dict):
    """
    Uses Nova Micro to score how relevant a prospect is
    to the campaign goal (0-100).
    """

    prompt = f"""
You are an AI outreach assistant.

Your job is to score how relevant a prospect is for the outreach goal.

Goal:
{goal}

Prospect Profile:
{json.dumps(prospect, indent=2)}

Score the prospect from 0 to 100.

Scoring rules:

100 = perfect match
80-90 = strong match
60-79 = somewhat relevant
40-59 = weak relevance
0-39 = not relevant

Return ONLY JSON.

Format:

{{
 "score": number,
 "reason": "short explanation"
}}
"""

    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 200,
            "temperature": 0.2
        }
    }

    body_str = json.dumps(body)

    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                bedrock.invoke_model,
                modelId=MODEL_ID,
                body=body_str
            )
            response_body = json.loads(response["body"].read())
            text_output = response_body["output"]["message"]["content"][0]["text"]

            # Clean markdown if model adds it
            text_output = text_output.replace("```json", "").replace("```", "").strip()

            try:
                result = json.loads(text_output)
                return {
                    "prospect": prospect,
                    "score": result.get("score"),
                    "reason": result.get("reason")
                }
            except Exception:
                print("⚠️ Scoring parse failed")
                print(text_output)
                return {
                    "prospect": prospect,
                    "score": None,
                    "reason": "parse_failed"
                }

        except Exception as e:
            print(f"⚠️ Bedrock scorer error (attempt {attempt + 1}): {e}")
            if attempt == 2:
                return {
                    "prospect": prospect,
                    "score": None,
                    "reason": "api_error"
                }
            await asyncio.sleep(1.5)

    # Should never reach here, but safety net
    return {"prospect": prospect, "score": None, "reason": "unknown_error"}