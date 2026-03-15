import asyncio
from backend.tools.nova_client import invoke_nova_micro

async def snippet_extractor(snippet: str) -> dict:
    sys = "You are a snippet analyzer. Output ONLY a single strict JSON object — NOT an array, NOT a list."
    user = f"""Extract the person's name and company from this search snippet.

Snippet: {snippet}

Return ONLY this exact JSON format — a single object with two keys, no wrapping array:
{{"name": "Full Name Here", "company": "Company Name Here"}}

Rules:
- Output a plain JSON object (curly braces), NOT a JSON array (square brackets)
- Do NOT wrap the result in [ ] — that would be wrong
- If name not found, use "unknown"
- If company not found, use "unknown"
- No markdown, no code blocks, no extra text — just the JSON object
"""
    return await invoke_nova_micro(sys, user)

async def profile_builder(prospect_data: dict, cross_data: dict, linkedin_data: dict) -> dict:
    sys = "You are an expert profile synthesizer. Output ONLY strict JSON."
    user = f"""Extract and synthesize a structured profile from this raw data:
Prospect: {prospect_data}
Cross-platform: {cross_data}
LinkedIn Data: {linkedin_data}

Return JSON:
{{
  "name": "full name or unknown",
  "role": "current role or unknown",
  "company": "current company or unknown",
  "location": "location or unknown",
  "summary": "1 sentence professional summary",
  "relevance_score": 85,
  "match_reason": "One line explaining why they match the goal",
  "links": {{"linkedin": "", "github": "", "twitter": "", "blog": ""}}
}}
"""
    return await invoke_nova_micro(sys, user)

async def recency_detector(cross_data: dict, linkedin_data: dict) -> dict:
    sys = "You are a recency signal detector. Extract recent activities with timestamps. Output ONLY strict JSON."
    user = f"""Extract recent signals (commits, posts, articles, job changes).
Data: {cross_data} {linkedin_data}

Return JSON with a single list of objects under "signals":
{{
  "signals": [
     {{"action": "what they did (e.g., open-sourced a repo)", "time_ago": "e.g., 4 days ago", "source": "GitHub", "is_fresh": true/false (< 30 days is fresh)}}
  ]
}}
If none found, return empty list.
"""
    return await invoke_nova_micro(sys, user)

async def tone_analyzer(cross_data: dict, linkedin_data: dict) -> dict:
    sys = "You are a communication tone analyzer. Output ONLY strict JSON."
    user = f"""Analyze the writing style and tone based on their posts and bios.
Data: {cross_data} {linkedin_data}

Return JSON:
{{
  "style": "Overall style (e.g. casual-technical)",
  "formality": "high/med/low",
  "emoji_usage": "high/med/low/none",
  "vocabulary": "simple/technical/academic",
  "analysis_paragraph": "A short 2-3 sentence paragraph explaining their communication style.",
  "quote": "A direct quote from their posts if available, else null"
}}
"""
    return await invoke_nova_micro(sys, user)

async def red_flag_detector(prospect_data: dict, cross_data: dict, linkedin_data: dict) -> dict:
    sys = "You are a red flag detector for outbound outreach. Output ONLY strict JSON."
    user = f"""Identify potential reasons to NOT reach out to this person (e.g. "no cold outreach" in bio, inactive for > 11 months, layoffs at company).
Data: {prospect_data} {cross_data} {linkedin_data}

Return JSON with list "flags":
{{
  "flags": [
     {{"flag": "description of flag", "severity": "HIGH/MED/LOW", "reason": "why it matters"}}
  ]
}}
If no flags, return empty list.
"""
    return await invoke_nova_micro(sys, user)

async def icebreaker_generator(prospect_data: dict, cross_data: dict, linkedin_data: dict) -> dict:
    sys = "You are an expert icebreaker generator. Output ONLY strict JSON."
    user = f"""Generate exactly 3 specific, context-rich ONE-LINER icebreakers based on their profile and recent activity.
Data: {prospect_data} {cross_data} {linkedin_data}

Return JSON with list "icebreakers":
{{
  "icebreakers": [
     {{"text": "the one-liner", "source": "Where this came from (e.g., Based on their GitHub commit 4 days ago)"}}
  ]
}}
"""
    return await invoke_nova_micro(sys, user)

async def message_drafter(goal: str, plan: dict, profile: dict, recency: dict, tone: dict, icebreakers: dict, sender_details: dict = None) -> dict:
    sys = "You are a master copywriter. Read the inputs and generate a DM and Email draft. Output ONLY strict JSON."

    # Build sender context block — falls back to empty if not provided
    sd = sender_details or {}
    sender_name    = sd.get("name", "").strip()
    sender_role    = sd.get("role", "").strip()
    sender_company = sd.get("company", "").strip()
    sender_oneliner = sd.get("oneliner", "").strip()

    if sender_name:
        sender_block = f"""
The person sending this message:
Name: {sender_name}
{f'Role: {sender_role}' if sender_role else ''}
{f'Company: {sender_company}' if sender_company else ''}
{f'About them: {sender_oneliner}' if sender_oneliner else ''}

Use this to sign off the message naturally and to frame the outreach from a real person's perspective.
Instead of a generic opener, start with context about who is reaching out and why it is relevant.

DM format (60-80 words):
- Open with one specific thing about the prospect
- One sentence about who you (the sender) are and why relevant
- Clear ask or conversation starter
- Sign off with: {sender_name}

Email format (120 words max):
- Subject line that references something specific about the prospect
- Same structure as DM but with slightly more context on the sender
- Professional close with name{f' + {sender_role}' if sender_role else ''}{f' + {sender_company}' if sender_company else ''}
"""
    else:
        sender_block = "Sign off messages naturally without a specific sender name."

    user = f"""Goal: {goal}
Plan: {plan}
Profile: {profile}
Recency: {recency}
Tone: {tone}
Icebreakers: {icebreakers}
{sender_block}

Using the best icebreaker and writing in a tone matching theirs (if appropriate), draft outreach messages.

Return JSON:
{{
  "dm_draft": "Short, punchy LinkedIn DM (60-80 words)",
  "email_draft": "Longer email (120 words max)",
  "dm_rationale": "Why this DM works based on personalization",
  "email_rationale": "Why this Email works based on personalization"
}}
"""
    return await invoke_nova_micro(sys, user)
