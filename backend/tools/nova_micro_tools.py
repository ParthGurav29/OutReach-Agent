import asyncio
from backend.tools.nova_client import invoke_nova_micro

async def snippet_extractor(snippet: str) -> dict:
    sys = "You are a snippet analyzer. Output ONLY strict JSON."
    user = f"""Extract name and company from this search snippet: {snippet}
Return JSON: {{"name": "...", "company": "..."}}
If not found, use "unknown".
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

async def message_drafter(goal: str, plan: dict, profile: dict, recency: dict, tone: dict, icebreakers: dict) -> dict:
    sys = "You are a master copywriter. Read the inputs and generate a DM and Email draft. Output ONLY strict JSON."
    user = f"""Goal: {goal}
Plan: {plan}
Profile: {profile}
Recency: {recency}
Tone: {tone}
Icebreakers: {icebreakers}

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
