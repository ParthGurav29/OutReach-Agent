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


async def generate_variant(prospect, goal, tone, personal_context, sender_name):

    prompt = f"""
You are writing a cold outreach email ON BEHALF OF {sender_name}.
Write in first person as {sender_name}. Sign off with "{sender_name}".
NEVER use placeholders like [Your Name], [Name], [Company].

PROSPECT:
Name: {prospect.get("name")}
Role: {prospect.get("role")}
Company: {prospect.get("company", "")}

PERSONALISATION (use in FIRST sentence):
{personal_context}

GOAL:
{goal}

TONE:
{tone}

RULES:
1. First sentence MUST reference the personalisation context specifically.
2. Subject MUST reference the personalisation context.
3. NEVER use: "I hope this finds you well", "I noticed your background in", "Just reaching out", "I came across your profile".
4. 80 to 120 words.
5. End with one soft CTA.
6. Sign off as "{sender_name}" only.
7. Zero placeholders.

Return ONLY valid JSON:

{{
  "subject": "...",
  "body": "...",
  "personalisation_used": "...",
  "word_count": <integer>
}}
"""

    result = await call_model(prompt)
    if not result:
        return None

    result["word_count"] = len(result.get("body", "").split())

    # Reject if placeholders snuck in
    body = result.get("body", "")
    if "[" in body or "]" in body:
        return None

    return result


async def expand_email(email, sender_name):
    prompt = f"""
Rewrite this email. Written by {sender_name}.
- 80 to 120 words
- Same personalisation and subject
- Sign off as "{sender_name}"
- Zero placeholders

Return ONLY valid JSON:
{{
  "subject": "...",
  "body": "...",
  "personalisation_used": "...",
  "word_count": <integer>
}}

EMAIL:
{email}
"""
    result = await call_model(prompt)
    if result:
        result["word_count"] = len(result.get("body", "").split())
    return result


async def draft_email(prospect: dict, goal: str, tone: str, sender_name: str = ""):

    personal_context = (
        prospect.get("personalisation_hook")
        or prospect.get("recent_work")
        or ", ".join(prospect.get("skills") or [])
        or prospect.get("role")
        or "their work"
    )

    if not sender_name:
        sender_name = os.getenv("SENDER_NAME", "the team")

    variants = []

    for _ in range(3):

        email = await generate_variant(
            prospect, goal, tone, personal_context, sender_name
        )

        if not email:
            continue

        wc = email.get("word_count", 0)

        if wc < 80:
            print(f"⚠️ Email too short ({wc}) → expanding")
            expanded = await expand_email(email["body"], sender_name)
            if expanded:
                email = expanded
                email["word_count"] = len(email.get("body", "").split())

        review = review_email(
            email=email["body"],
            prospect_profile=prospect,
            goal=goal,
            tone=tone
        )

        email["quality_review"] = review

        print(f"\n🧪 QUALITY CHECK — {prospect.get('name')}")
        print(review)

        if not review.get("passed"):
            print(f"⚠️ Rewriting email for {prospect.get('name')}")
            rewritten = review.get("rewritten_email")
            if rewritten:
                email["body"] = rewritten
                email["word_count"] = len(rewritten.split())

        variants.append(email)

    best = None
    best_score = -1

    for v in variants:
        score = v.get("quality_review", {}).get("score", 0)
        if score > best_score:
            best = v
            best_score = score

    if not best:
        fallback_body = (
            f"Hi {prospect.get('name', 'there')},\n\n"
            f"I came across {personal_context} and wanted to reach out.\n\n"
            f"I'm {sender_name} — {goal}.\n\n"
            f"Would you be open to a quick chat?\n\n"
            f"{sender_name}"
        )
        return {
            "subject": f"Quick thought on {prospect.get('company', 'your work')}",
            "body": fallback_body,
            "personalisation_used": personal_context,
            "word_count": len(fallback_body.split()),
            "quality_review": {"passed": False, "issues": ["fallback used"], "score": 0}
        }

    return best