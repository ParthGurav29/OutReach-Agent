import os
import asyncio
from tavily import TavilyClient

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
if not TAVILY_API_KEY:
    raise ValueError("TAVILY_API_KEY not found in environment variables")

client = TavilyClient(api_key=TAVILY_API_KEY)

async def search_tavily(query: str):
    """
    Search using Tavily recursively or just basic depth depending on needs.
    """
    def _call():
        return client.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_raw_content=True
        )
    
    try:
        response = await asyncio.to_thread(_call)
        return response.get("results", [])
    except Exception as e:
        print(f"Tavily search failed for {query}: {e}")
        return []

async def parallel_search(queries: list[str]):
    tasks = [search_tavily(query) for query in queries]
    results = await asyncio.gather(*tasks)
    return results