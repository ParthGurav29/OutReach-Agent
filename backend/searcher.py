import os
import httpx
from dotenv import load_dotenv

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

TAVILY_URL = "https://api.tavily.com/search"


# ---------------------------------------------------
# SEARCH WEB
# ---------------------------------------------------

async def search_web(query: str):

    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set in environment")

    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "max_results": 10
    }

    try:

        async with httpx.AsyncClient(timeout=30) as client:

            response = await client.post(
                TAVILY_URL,
                json=payload
            )

            data = response.json()

            results = data.get("results", [])

            formatted_results = []

            for r in results:

                formatted_results.append({
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "snippet": r.get("content")
                })

            return formatted_results

    except Exception as e:

        print("⚠️ Tavily search failed:", e)

        return []