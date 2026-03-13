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
            "maxTokens": 700,
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

        # remove markdown fences if model wraps JSON
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        return text.strip()

    except Exception as e:

        print("⚠️ Model call failed:", e)
        return None


# ---------------------------------------------------
# QUALITY CHECK
# ---------------------------------------------------

def review_email(email: str, prospect_profile: dict, goal: str, tone: str):

    review_prompt = f"""
You are an expert evaluator of cold outreach emails.

Evaluate the quality of the email and give a score from 1 to 10.

Scoring rubric:

10 — excellent personalization, strong hook, clear CTA  
8–9 — strong email with minor improvements  
6–7 — acceptable but improvable  
4–5 — generic outreach  
1–3 — poor quality

Check for:

- generic openers (e.g. "I came across your profile")
- missing personalization
- incorrect facts about the prospect
- weak or vague CTA
- tone mismatch

Return ONLY JSON:

{{
 "score": number,
 "issues": [],
 "suggestions": []
}}

PROSPECT:
{json.dumps(prospect_profile)}

CAMPAIGN GOAL:
{goal}

TONE:
{tone}

EMAIL:
{email}
"""

    try:

        review_raw = call_model(review_prompt)

        if not review_raw:
            raise ValueError("Empty model response")

        review = json.loads(review_raw)

    except Exception as e:

        print("⚠️ Quality checker error:", e)

        return {
            "passed": True,
            "issues": [],
            "rewritten_email": None
        }

    score = review.get("score", 7)

    # ---------------------------------------------------
    # PASS CONDITION (Less strict)
    # ---------------------------------------------------

    if score >= 6:

        return {
            "passed": True,
            "issues": review.get("issues", []),
            "rewritten_email": None
        }

    # ---------------------------------------------------
    # REWRITE EMAIL
    # ---------------------------------------------------

    rewrite_prompt = f"""
Improve this outreach email.

Fix these issues:

{review.get("issues")}

Requirements:

- 80 to 120 words
- strong personalization
- professional tone
- clear call-to-action

Return ONLY the rewritten email text.

EMAIL:
{email}
"""

    try:

        rewritten = call_model(rewrite_prompt)

        if not rewritten:
            raise ValueError("Rewrite failed")

        return {
            "passed": False,
            "issues": review.get("issues", []),
            "rewritten_email": rewritten.strip()
        }

    except Exception as e:

        print("⚠️ Rewrite failed:", e)

        return {
            "passed": False,
            "issues": review.get("issues", []),
            "rewritten_email": None
        }