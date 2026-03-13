import asyncio

from backend.tools.tavily_search import search_prospects
from backend.tools.extractor import extract_profiles
from backend.tools.scorer import score_prospects
from backend.tools.planner import replan_strategy


MAX_RETRIES = 2
MIN_GOOD_PROSPECTS = 5
SCORE_THRESHOLD = 60


async def adaptive_search(goal, queries):
    """
    Runs the prospect search pipeline with adaptive retries.

    Flow:
    search → extract → score → quality check
    If results are poor → re-plan search strategy and retry.

    Hard cap of MAX_RETRIES prevents infinite loops.
    """

    retry_count = 0

    while True:

        print(f"\nRunning Tavily search with queries: {queries}")

        # 1️⃣ Run Tavily Search
        raw_results = await search_prospects(queries)

        # 2️⃣ Extract prospect profiles
        prospects = await extract_profiles(raw_results)

        # 3️⃣ Score prospects
        scored_prospects = await score_prospects(prospects, goal)

        # 4️⃣ Check quality
        good_prospects = [
            p for p in scored_prospects
            if p.get("score", 0) >= SCORE_THRESHOLD
        ]

        print(f"{len(good_prospects)} prospects scored above {SCORE_THRESHOLD}")

        # If enough good prospects → success
        if len(good_prospects) >= MIN_GOOD_PROSPECTS:
            print("Quality threshold met. Proceeding with results.")
            return scored_prospects

        # If retry limit reached → stop
        if retry_count >= MAX_RETRIES:
            print("Max retry limit reached. Returning best available results.")
            return scored_prospects

        # Trigger adaptive strategy
        print("Low quality results detected. Adapting search strategy...")

        # Ask Nova Pro to re-plan queries
        queries = await replan_strategy(goal, queries)

        retry_count += 1

        print(f"Retry attempt #{retry_count} with new queries: {queries}")