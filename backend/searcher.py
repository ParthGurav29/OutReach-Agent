import os
import asyncio
from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv()

# Safely initialize the client
api_key = os.getenv("TAVILY_API_KEY")
if not api_key:
    print("⚠️ Warning: TAVILY_API_KEY is missing from your .env file!")

tavily = TavilyClient(api_key=api_key)



async def search_web(query):

    try:

        response = tavily.search(
            query=query,
            search_depth="basic",
            max_results=8   # 🔴 LIMIT HERE
        )

        return response.get("results", [])

    except Exception as e:

        print(f"⚠️ Tavily Search Error for query '{query}': {e}")
        return []
    

if __name__ == "__main__":
    import asyncio

    async def test():
        results = await search_web("SaaS founder communities")

        for r in results:
            print(r)

    asyncio.run(test())
