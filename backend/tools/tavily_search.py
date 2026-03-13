import os
from dotenv import load_dotenv
from tavily import TavilyClient

# Load environment variables
load_dotenv()

# Initialize Tavily client
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

if not TAVILY_API_KEY:
    raise ValueError("TAVILY_API_KEY not found in environment variables")

client = TavilyClient(api_key=TAVILY_API_KEY)


def search_company(company: str):
    """
    Search for company insights using Tavily.

    Args:
        company (str): Company name

    Returns:
        list[dict]: List of insights including title, summary, and URL
    """

    response = client.search(
        query=f"{company} company overview products",
        search_depth="basic",
        max_results=3
    )

    insights = []

    for r in response.get("results", []):
        insights.append({
            "title": r.get("title"),
            "summary": r.get("content"),
            "url": r.get("url")
        })

    return insights