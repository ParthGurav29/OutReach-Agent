import os
import aiohttp
import asyncio

PROXYCURL_API_KEY = os.getenv("PROXYCURL_API_KEY")

async def enrich_linkedin_profile(linkedin_url: str) -> dict:
    if not PROXYCURL_API_KEY:
        print("Proxycurl key missing, skipping enrichment")
        return {}

    headers = {'Authorization': f'Bearer {PROXYCURL_API_KEY}'}
    api_endpoint = 'https://nubela.co/proxycurl/api/v2/linkedin'
    params = {
        'url': linkedin_url,
        'fallback_to_cache': 'on-error',
        'use_cache': 'if-present',
        'skills': 'include',
        'extra': 'include',
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(api_endpoint, params=params, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Filter out big unused fields to save token space
                    return {
                        "experiences": data.get("experiences", [])[:3],
                        "education": data.get("education", [])[:2],
                        "certifications": data.get("certifications", [])[:3],
                        "headline": data.get("headline", ""),
                        "summary": data.get("summary", ""),
                        "activities": data.get("activities", [])[:5]
                    }
                else:
                    return {}
    except Exception as e:
        print(f"Proxycurl enrichment failed: {e}")
        return {}
