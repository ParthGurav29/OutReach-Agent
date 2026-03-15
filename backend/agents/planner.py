import json
from backend.tools.nova_client import invoke_nova_pro

async def plan_campaign(goal: str, previous_queries: list = None):
    sys_prompt = "You are an expert prospect research strategist."
    user_prompt = f"""
Goal: {goal}

Plan an outreach campaign. Generate exactly 5 highly targeted LinkedIn search queries.
Use site:linkedin.com/in and relevant keywords.
Do NOT repeat the following queries: {previous_queries or []}

Return STRICT JSON with keys:
- "search_queries": list of 5 strings
- "target_profile": string describing the ideal candidate
- "platforms": list of strings (e.g. ["GitHub", "Twitter", "Medium", "Substack"]) to search later
- "tone": string describing the ideal outreach tone
- "personalisation_angle": string describing how to hook them
"""

    return await invoke_nova_pro(sys_prompt, user_prompt, temp=0.7)