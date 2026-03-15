"""
proxycurl_enricher.py
---------------------
Fetches richer LinkedIn profile data using the Proxycurl API.
If PROXYCURL_API_KEY is not set, the function returns an empty dict
so the rest of the pipeline continues without crashing.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

PROXYCURL_API_KEY = os.getenv("PROXYCURL_API_KEY")
PROXYCURL_URL = "https://nubela.co/proxycurl/api/v2/linkedin"


async def enrich_linkedin_profile(linkedin_url: str) -> dict:
    """
    Fetches bio, headline, recent activity, and skills from a LinkedIn profile URL.

    Returns a dict with keys:
        - bio (str): summary / about section
        - headline (str): profile headline
        - skills (list[str]): top skills
        - recent_posts (list[str]): text of recent activity items (best-effort)
        - full_name (str)
        - location (str)
    Returns {} if the API key is missing or the call fails.
    """
    if not PROXYCURL_API_KEY:
        print(f"ℹ️  PROXYCURL_API_KEY not set — skipping deep LinkedIn enrichment for {linkedin_url}")
        return {}

    if not linkedin_url or "linkedin.com/in/" not in linkedin_url.lower():
        return {}

    headers = {"Authorization": f"Bearer {PROXYCURL_API_KEY}"}
    params = {
        "url": linkedin_url,
        "skills": "include",
        "extra": "include",
        "github_profile_id": "exclude",
        "facebook_profile_id": "exclude",
        "twitter_profile_id": "exclude",
        "personal_contact_number": "exclude",
        "personal_email": "exclude",
        "inferred_salary": "exclude",
        "use_cache": "if-present",
        "fallback_to_cache": "on-error",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(PROXYCURL_URL, headers=headers, params=params)

        if response.status_code != 200:
            print(f"⚠️  Proxycurl returned {response.status_code} for {linkedin_url}")
            return {}

        data = response.json()

        # Extract recent activity (Proxycurl exposes this under `activities`)
        activities = data.get("activities", []) or []
        recent_posts = [a.get("title", "") for a in activities[:3] if a.get("title")]

        enriched = {
            "full_name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "headline": data.get("headline", ""),
            "bio": data.get("summary", ""),
            "location": data.get("city") or data.get("country_full_name", ""),
            "skills": [s.get("name", "") for s in (data.get("skills") or [])[:10]],
            "recent_posts": recent_posts,
        }

        print(f"✅ Proxycurl enriched: {enriched['full_name']} — {enriched['headline'][:60]}")
        return enriched

    except Exception as e:
        print(f"⚠️  Proxycurl enrichment failed for {linkedin_url}: {e}")
        return {}
