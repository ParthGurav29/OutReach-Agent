"""
drafter.py — LinkedIn DM Drafter (CCQ Method)
----------------------------------------------
Generates 3 variants of LinkedIn Direct Messages using the CCQ framework:
  1. Compliment  — opens with a genuine compliment about their work / company.
  2. Commonality — opens by surfacing a shared experience, mutual connection, or interest.
  3. Question    — opens with a thought-provoking question related to their context.

Each DM is kept at 50–80 words to respect LinkedIn message etiquette.
"""

import os
import json
import boto3
import asyncio
from dotenv import load_dotenv

from backend.tools.quality_checker import review_email

load_dotenv()

MODEL_ID   = os.getenv("NOVA_MICRO_MODEL_ID")
AWS_REGION = os.getenv("AWS_REGION")

if not MODEL_ID:
    raise ValueError("NOVA_MICRO_MODEL_ID not set")
if not AWS_REGION:
    raise ValueError("AWS_REGION not set")

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)


# ─────────────────────────────────────────────────────────────────
# Bedrock LLM wrapper
# ─────────────────────────────────────────────────────────────────

async def call_model(prompt: str):
    body = {
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {"maxTokens": 600, "temperature": 0.65},
    }
    body_str = json.dumps(body)

    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                bedrock.invoke_model,
                modelId=MODEL_ID,
                body=body_str,
            )
            raw  = json.loads(response["body"].read())
            text = raw["output"]["message"]["content"][0]["text"].strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]

            return json.loads(text)

        except Exception as e:
            print(f"⚠️ Drafter Model call failed (attempt {attempt + 1}): {e}")
            if attempt == 2:
                return None
            await asyncio.sleep(1.5)


# ─────────────────────────────────────────────────────────────────
# CCQ LinkedIn DM Generator
# ─────────────────────────────────────────────────────────────────

async def generate_linkedin_dms(
    prospect: dict,
    goal: str,
    tone: str,
    personal_context: str,
    sender_name: str,
    seeking: str,
) -> list | None:
    """
    Generates 3 LinkedIn DM variants using the CCQ method.
    Uses Tavily search snippets for personalisation (no Proxycurl).
    """

    sender_identity = f"I'm {sender_name}" if sender_name else "I'm reaching out"
    if seeking:
        sender_identity += f", {seeking}"

    # Build enrichment block from Tavily snippet data already on prospect
    enrichment_block = ""
    if prospect.get("recent_work"):
        enrichment_block += f"\nRecent Activity: {prospect['recent_work']}"
    if prospect.get("skills"):
        skills_list = prospect["skills"] if isinstance(prospect["skills"], list) else [prospect["skills"]]
        enrichment_block += f"\nSkills: {', '.join(skills_list[:5])}"

    prompt = f"""
You are writing LinkedIn DMs ON BEHALF OF {sender_name or "the sender"}.

SENDER: {sender_identity}
CAMPAIGN GOAL: {goal}
TONE: {tone}

PROSPECT:
Name: {prospect.get("name")}
Role: {prospect.get("role")}
Company: {prospect.get("company", "")}
LinkedIn Context: {personal_context}
{enrichment_block}

CCQ METHOD — Generate exactly 3 LinkedIn DM variants:

1. "Compliment"  — Open with a GENUINE and SPECIFIC compliment about their work, company, or a recent achievement. Do NOT be generic.
2. "Commonality" — Open by surfacing a REAL or PLAUSIBLE shared experience, interest, mutual connection, or industry challenge.
3. "Question"    — Open with a THOUGHT-PROVOKING question directly relevant to their role or company situation.

ALL 3 VARIANTS MUST FOLLOW THESE RULES:
- 50–80 words ONLY — LinkedIn messages must be concise.
- NO subject line — this is a DM, not an email.
- Do NOT use: "I hope this finds you well", "I noticed your profile", "Just reaching out", "I came across your profile".
- Make it feel HUMAN and WARM, not salesy.
- Include ONE soft CTA (e.g., "Would you be open to a quick 15-min chat?").
- Sign off as "{sender_name}" only.
- ZERO placeholders like [Name], [Company], [Your Name].

Return ONLY valid JSON — an array of exactly 3 objects:
[
  {{
    "type": "Compliment",
    "body": "...",
    "personalisation_used": "..."
  }},
  {{
    "type": "Commonality",
    "body": "...",
    "personalisation_used": "..."
  }},
  {{
    "type": "Question",
    "body": "...",
    "personalisation_used": "..."
  }}
]
"""

    result = await call_model(prompt)
    if not isinstance(result, list):
        return None

    valid_variants = []
    for r in result:
        body = r.get("body", "")
        if body and "[" not in body and "]" not in body:
            r["word_count"] = len(body.split())
            # Add a synthetic subject for UI compatibility (not used in DM)
            r["subject"] = f"LinkedIn DM — {r.get('type', '')}"
            valid_variants.append(r)

    return valid_variants or None


# ─────────────────────────────────────────────────────────────────
# Fallback DM expander
# ─────────────────────────────────────────────────────────────────

async def expand_dm(dm_body: str, sender_name: str, seeking: str) -> dict | None:
    seek_line = f"seeking {seeking}" if seeking else ""
    prompt = f"""
Rewrite this LinkedIn DM. Written by {sender_name} {seek_line}.
- 50 to 80 words
- Keep same personalisation hook
- Make the sender's identity and ask clear
- Sign off as "{sender_name}"
- ZERO placeholders

Return ONLY valid JSON:
{{
  "body": "...",
  "personalisation_used": "..."
}}

DM:
{dm_body}
"""
    result = await call_model(prompt)
    if result:
        result["word_count"] = len(result.get("body", "").split())
    return result


# ─────────────────────────────────────────────────────────────────
# Main entry point (called by orchestrator)
# ─────────────────────────────────────────────────────────────────

async def draft_email(
    prospect: dict,
    goal: str,
    tone: str,
    sender_name: str = "",
    seeking: str = "",
):
    """
    Main drafting function. Now generates LinkedIn DMs via CCQ method.
    The return shape is backwards-compatible with the existing orchestrator/UI:
      {
        "subject": str,         # synthetic — "LinkedIn DM — Compliment"
        "body": str,            # body of first (Compliment) variant
        "variants": [...],      # all 3 CCQ variants
      }
    """
    personal_context = (
        prospect.get("personalisation_hook")
        or prospect.get("recent_work")
        or ", ".join(prospect.get("skills") or [])
        or prospect.get("role")
        or "their work"
    )

    if not sender_name:
        sender_name = os.getenv("SENDER_NAME", "the team")

    # ── Generate CCQ DMs ──────────────────────────────────────────
    variants = await generate_linkedin_dms(
        prospect         = prospect,
        goal             = goal,
        tone             = tone,
        personal_context = personal_context,
        sender_name      = sender_name,
        seeking          = seeking,
    )

    # ── Fallback if generation failed ────────────────────────────
    if not variants:
        seek_line    = f"seeking {seeking}" if seeking else ""
        fallback_body = (
            f"Hi {prospect.get('name', 'there')},\n\n"
            f"Really admire what {prospect.get('company', 'your team')} is building. "
            f"I'm {sender_name}{', ' + seek_line if seek_line else ''}.\n\n"
            f"Would you be open to a quick 15-min chat?\n\n{sender_name}"
        )
        variants = [
            {
                "type": "Compliment",
                "subject": "LinkedIn DM — Compliment",
                "body": fallback_body,
                "personalisation_used": personal_context,
                "word_count": len(fallback_body.split()),
                "quality_review": {"passed": False, "issues": ["fallback used"], "score": 0},
            },
            {
                "type": "Commonality",
                "subject": "LinkedIn DM — Commonality",
                "body": fallback_body,
                "personalisation_used": personal_context,
                "word_count": len(fallback_body.split()),
                "quality_review": {"passed": False, "issues": ["fallback used"], "score": 0},
            },
            {
                "type": "Question",
                "subject": "LinkedIn DM — Question",
                "body": fallback_body,
                "personalisation_used": personal_context,
                "word_count": len(fallback_body.split()),
                "quality_review": {"passed": False, "issues": ["fallback used"], "score": 0},
            },
        ]
        return {
            "subject": variants[0]["subject"],
            "body": variants[0]["body"],
            "variants": variants,
        }

    # ── Expand too-short DMs and quality-check ───────────────────
    for variant in variants:
        wc = variant.get("word_count", 0)
        if wc < 50:
            print(f"⚠️ DM too short ({wc}w) → expanding for {prospect.get('name')}")
            expanded = await expand_dm(variant["body"], sender_name, seeking)
            if expanded:
                variant["body"]       = expanded.get("body", variant["body"])
                variant["word_count"] = len(variant["body"].split())

        review = review_email(
            email            = variant["body"],
            prospect_profile = prospect,
            goal             = goal,
            tone             = tone,
        )
        variant["quality_review"] = review
        print(f"🧪 QUALITY — {prospect.get('name')} ({variant.get('type')}) | score: {review.get('score', '?')}")

        if not review.get("passed"):
            rewritten = review.get("rewritten_email")
            if rewritten:
                variant["body"]       = rewritten
                variant["word_count"] = len(rewritten.split())

    default = variants[0]
    return {
        "subject": default.get("subject", "LinkedIn DM"),
        "body":    default.get("body", ""),
        "variants": variants,
    }