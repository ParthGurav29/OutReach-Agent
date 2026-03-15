import os
import httpx
from dotenv import load_dotenv

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
TAVILY_URL = "https://api.tavily.com/search"


# ---------------------------------------------------
# SEARCH WEB — LinkedIn-first strategy
# ---------------------------------------------------

async def search_web(query: str):
    """
    Searches Tavily and returns results, prioritising LinkedIn profile URLs.
    Non-LinkedIn results are kept as fallback but LinkedIn ones sort to top.
    """
    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set in environment")

    # Inject 'site:linkedin.com/in' bias if not already present
    if "linkedin.com" not in query.lower():
        linkedin_query = f'site:linkedin.com/in {query}'
    else:
        linkedin_query = query

    payload = {
        "api_key": TAVILY_API_KEY,
        "query": linkedin_query,
        "search_depth": "basic",
        "max_results": 10,
        "include_domains": ["linkedin.com"],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(TAVILY_URL, json=payload)
            data = response.json()
            results = data.get("results", [])

            formatted_results = []
            linkedin_results = []
            other_results = []

            for r in results:
                url = r.get("url", "")
                record = {
                    "title": r.get("title"),
                    "url": url,
                    "snippet": r.get("content"),
                    "is_linkedin": "linkedin.com/in/" in url.lower(),
                }
                if record["is_linkedin"]:
                    linkedin_results.append(record)
                else:
                    other_results.append(record)

            # LinkedIn profiles first
            formatted_results = linkedin_results + other_results
            return formatted_results

    except Exception as e:
        print("⚠️ Tavily search failed:", e)
        return []