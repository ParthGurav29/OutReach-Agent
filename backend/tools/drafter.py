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

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)


async def call_model(prompt):
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 500, "temperature": 0.6}
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


async def generate_variant(prospect, goal, tone, personal_context, sender_name, seeking):

    # Build sender identity block
    sender_identity = f"My name is {sender_name}" if sender_name else "I'm reaching out"
    if seeking:
        sender_identity += f" and I'm seeking {seeking}"

    prompt = f"""
You are writing a cold outreach email ON BEHALF OF {sender_name or "the sender"}.

SENDER IDENTITY:
{sender_identity}

PROSPECT:
Name: {prospect.get("name")}
Role: {prospect.get("role")}
Company: {prospect.get("company", "")}

PERSONALISATION CONTEXT (reference this in the FIRST sentence):
{personal_context}

CAMPAIGN GOAL:
{goal}

TONE:
{tone}

STRICT RULES:
1. First sentence MUST reference the personalisation context — name a specific project, newsletter, company, or achievement.
2. Subject MUST reference the personalisation context.
3. NEVER use: "I hope this finds you well", "I noticed your background in", "Just reaching out", "I came across your profile".
4. The email must clearly state WHO the sender is and WHAT they are seeking — use the sender identity naturally.
5. Body must be 80–120 words.
6. End with ONE soft CTA.
7. Sign off as "{sender_name}" only — no title, no placeholders.
8. ZERO placeholders like [Your Name], [Company], [Position].

Return ONLY valid JSON:

{{
  "subject": "subject referencing personalisation context",
  "body": "complete email signed as {sender_name}",
  "personalisation_used": "exact detail from context referenced in first sentence",
  "word_count": <integer>
}}
"""

    result = await call_model(prompt)
    if not result:
        return None

    result["word_count"] = len(result.get("body", "").split())

    body = result.get("body", "")
    if "[" in body or "]" in body:
        return None

    return result


async def expand_email(email_body, sender_name, seeking):
    seek_line = f"seeking {seeking}" if seeking else ""
    prompt = f"""
Rewrite this email. Written by {sender_name} {seek_line}.
- 80 to 120 words
- Keep same personalisation and subject
- Make the sender's identity and ask clear
- Sign off as "{sender_name}"
- ZERO placeholders

Return ONLY valid JSON:
{{
  "subject": "...",
  "body": "...",
  "personalisation_used": "...",
  "word_count": <integer>
}}

EMAIL:
{email_body}
"""
    result = await call_model(prompt)
    if result:
        result["word_count"] = len(result.get("body", "").split())
    return result


async def draft_email(prospect: dict, goal: str, tone: str, sender_name: str = "", seeking: str = ""):

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
            prospect, goal, tone, personal_context, sender_name, seeking
        )

        if not email:
            continue

        wc = email.get("word_count", 0)

        if wc < 80:
            print(f"⚠️ Email too short ({wc}w) → expanding")
            expanded = await expand_email(email["body"], sender_name, seeking)
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

        print(f"\n🧪 QUALITY — {prospect.get('name')} | score: {review.get('score', '?')}")

        if not review.get("passed"):
            rewritten = review.get("rewritten_email")
            if rewritten:
                email["body"] = rewritten
                email["word_count"] = len(rewritten.split())

        variants.append(email)

    best = max(variants, key=lambda v: v.get("quality_review", {}).get("score", 0)) if variants else None

    if not best:
        seek_line = f"seeking {seeking}" if seeking else ""
        fallback_body = (
            f"Hi {prospect.get('name', 'there')},\n\n"
            f"I came across {personal_context} and wanted to reach out.\n\n"
            f"I'm {sender_name}{', ' + seek_line if seek_line else ''}. {goal}.\n\n"
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