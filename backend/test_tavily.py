from tavily import TavilyClient

#client = TavilyClient(api_key="tvly-dev-eQ6nb-f1VMEG8rIVStvly-dev-1mtwua-jDEta5bFLxhD0Ny02d6IO3VKxSmdhDxYHjgy21nhlsltPm7tjcF0q18ZYmnYyXWsutH")

response = client.search(
    query="latest AI outreach tools 2026",
    search_depth="basic"
)

for r in response["results"][:3]:
    print("\nTitle:", r["title"])
    print("URL:", r["url"])
    print("Summary:", r["content"])