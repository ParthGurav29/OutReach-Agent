import os
import json
import boto3
import asyncio
from dotenv import load_dotenv

from backend.tools.quality_checker import review_email

load_dotenv()

MODEL_ID = os.getenv("NOVA_MICRO_MODEL_ID")
AWS_REGION = os.getenv("AWS_REGION")

if not MODEL_ID:
    raise ValueError("NOVA_MICRO_MODEL_ID not set")

if not AWS_REGION:
    raise ValueError("AWS_REGION not set")

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION
)


# -----------------------------------------
# CALL NOVA MODEL
# -----------------------------------------

async def call_model(prompt):

    loop = asyncio.get_running_loop()

    response = await loop.run_in_executor(
        None,
        lambda: bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "messages": [
                    {"role": "user", "content": [{"text": prompt}]}
                ],
                "inferenceConfig": {
                    "maxTokens": 500,
                    "temperature": 0.6
                }
            })
        )
    )

    raw = json.loads(response["body"].read())
    text = raw["output"]["message"]["content"][0]["text"].strip()

    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        return json.loads(text)
    except:
        return None


# -----------------------------------------
# GENERATE EMAIL VARIANT
# -----------------------------------------

async def generate_variant(prospect, goal, tone, personal_context):

    prompt = f"""
Write a cold outreach email.

PROSPECT:
Name: {prospect.get("name")}
Role: {prospect.get("role")}

CONTEXT:
{personal_context}

GOAL:
{goal}

TONE:
{tone}

RULES:
- 80 to 120 words
- strong personalization
- clear CTA
- no placeholders

Return JSON:

{{
 "subject": "...",
 "body": "...",
 "personalisation_used": "...",
 "word_count": number
}}
"""

    result = await call_model(prompt)

    if not result:
        return None

    result["word_count"] = len(result.get("body", "").split())

    return result


# -----------------------------------------
# EXPAND SHORT EMAIL
# -----------------------------------------

async def expand_email(email):

    prompt = f"""
Rewrite this email.

Requirements:
- 80 to 120 words
- same subject
- stronger explanation
- better call-to-action

Return JSON:

{{
 "subject": "...",
 "body": "...",
 "personalisation_used": "...",
 "word_count": number
}}

EMAIL:
{email}
"""

    return await call_model(prompt)


# -----------------------------------------
# MAIN EMAIL AGENT
# -----------------------------------------

async def draft_email(prospect: dict, goal: str, tone: str):

    personal_context = (
        prospect.get("personalisation_hook")
        or prospect.get("recent_work")
        or ", ".join(prospect.get("skills") or [])
        or prospect.get("role")
        or "their work"
    )

    variants = []

    # -----------------------------------------
    # GENERATE 3 EMAIL VARIANTS
    # -----------------------------------------

    for _ in range(3):

        email = await generate_variant(
            prospect,
            goal,
            tone,
            personal_context
        )

        if not email:
            continue

        wc = email.get("word_count", 0)

        # -----------------------------------------
        # EXPAND IF TOO SHORT
        # -----------------------------------------

        if wc < 80:

            print(f"⚠️ Email too short ({wc}) → expanding")

            expanded = await expand_email(email["body"])

            if expanded:
                email = expanded
                email["word_count"] = len(email.get("body", "").split())

        # -----------------------------------------
        # QUALITY CHECK
        # -----------------------------------------

        review = review_email(
            email=email["body"],
            prospect_profile=prospect,
            goal=goal,
            tone=tone
        )

        email["quality_review"] = review

        print("\n🧪 QUALITY CHECK")
        print(review)

        # -----------------------------------------
        # TASK 3 — AUTO REWRITE IF FAILED
        # -----------------------------------------

        if not review.get("passed"):

            print(f"⚠️ Rewriting email for {prospect.get('name')}")

            rewritten = review.get("rewritten_email")

            if rewritten:
                email["body"] = rewritten
                email["word_count"] = len(rewritten.split())

        variants.append(email)

    # -----------------------------------------
    # SELECT BEST EMAIL
    # -----------------------------------------

    best = None
    best_score = -1

    for v in variants:

        score = v.get("quality_review", {}).get("score", 0)

        if score > best_score:
            best = v
            best_score = score

    # -----------------------------------------
    # FALLBACK IF NOTHING GENERATED
    # -----------------------------------------

    if not best:

        fallback = f"""
Hi {prospect.get('name')},

I noticed your background in {personal_context}. I’m currently connecting with people working in this space and thought it would be great to exchange ideas.

Would you be open to a quick conversation sometime?

Best
"""

        return {
            "subject": "Quick idea exchange",
            "body": fallback.strip(),
            "personalisation_used": personal_context,
            "word_count": len(fallback.split()),
            "quality_review": {
                "passed": True,
                "issues": [],
                "rewritten_email": None
            }
        }

    return best