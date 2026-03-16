import os
import asyncio
from tavily import TavilyClient

# Load multiple keys if available (e.g. TAVILY_API_KEY_1, TAVILY_API_KEY_2...)
# Fallback to TAVILY_API_KEY if no numbered keys exist
_keys = [
    os.getenv(f"TAVILY_API_KEY_{i}") for i in range(1, 6)
]
_keys = [k for k in _keys if k]

if not _keys:
    # Single key fallback
    single_key = os.getenv("TAVILY_API_KEY")
    if single_key:
        _keys = [single_key]
    else:
        raise ValueError("No TAVILY_API_KEY found in environment variables")

# State for rotation
class KeyRotator:
    def __init__(self, keys):
        self.keys = keys
        self.index = 0
        self.client = TavilyClient(api_key=self.keys[self.index])

    def rotate(self):
        self.index = (self.index + 1) % len(self.keys)
        print(f"🔄 Rotating Tavily API Key to slot {self.index + 1}...")
        self.client = TavilyClient(api_key=self.keys[self.index])

rotator = KeyRotator(_keys)

async def search_tavily(query: str, depth="advanced"):
    """
    Search using Tavily with automatic key rotation on failure.
    """
    max_retries = len(_keys)
    
    for attempt in range(max_retries):
        try:
            def _call():
                return rotator.client.search(
                    query=query,
                    search_depth=depth,
                    max_results=8,
                    include_raw_content=True
                )
            
            response = await asyncio.to_thread(_call)
            return response.get("results", [])

        except Exception as e:
            error_msg = str(e).lower()
            # If it's a credit/rate limit issue, rotate and retry
            if "403" in error_msg or "429" in error_msg or "credit" in error_msg or "limit" in error_msg:
                print(f"⚠️  Tavily Key Error (Slot {rotator.index + 1}): {e}")
                if len(_keys) > 1 and attempt < max_retries - 1:
                    rotator.rotate()
                    continue
            
            print(f"❌ Tavily search failed for {query}: {e}")
            return []

async def parallel_search(queries: list[str]):
    tasks = [search_tavily(query) for query in queries]
    results = await asyncio.gather(*tasks)
    return results


