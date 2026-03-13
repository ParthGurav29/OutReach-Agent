import asyncio

from backend.session_store import build_memory_context, get_session
from backend.agents.planner import generate_campaign_plan
from backend.searcher import search_web
from backend.tools.extractor import extract_prospect
from backend.tools.scorer import score_prospect
from backend.tools.drafter import draft_email


# -----------------------------
# Adaptive Loop Config
# -----------------------------

MAX_RETRIES = 2
MIN_GOOD_PROSPECTS = 5
SCORE_THRESHOLD = 60


async def plan_campaign(goal: str, session_id: str):

    print("\n🚀 Running campaign")
    print("Goal:", goal)

    memory_context = build_memory_context(session_id)

    session = get_session(session_id)
    already_targeted = set(session["prospects_targeted"])

    # -----------------------------
    # STEP 1 — Generate Campaign Plan
    # -----------------------------

    plan = await generate_campaign_plan(goal, memory_context)

    print("\n📋 Campaign Plan Generated:\n")
    print(plan)

    if not plan or "campaign_plan" not in plan:
        print("⚠️ No campaign plan generated")
        return {}

    campaign_plan = plan["campaign_plan"]
    search_queries = campaign_plan.get("search_queries", [])

    if not search_queries:
        print("⚠️ No search queries generated")
        return {}

    retry_count = 0

    while True:

        print("\n==============================")
        print("🔎 RUNNING SEARCH QUERIES")
        print("==============================")

        all_results = []

        for query in search_queries[:3]:
            print(f"🔍 {query}")

            results = await search_web(query)

            print(f"Found {len(results)} results")

            all_results.extend(results)

        # -----------------------------
        # STEP 2 — Deduplicate URLs
        # -----------------------------

        seen = set()
        unique_results = []

        for r in all_results:

            url = r["url"]

            if url not in seen:
                seen.add(url)
                unique_results.append(r)

        unique_results = unique_results[:30]

        print("\n==============================")
        print(f"TOTAL UNIQUE RESULTS: {len(unique_results)}")
        print("==============================\n")

        # -----------------------------
        # STEP 3 — Extract Prospects
        # -----------------------------

        print("\n🧠 Extracting prospects...\n")

        extraction_tasks = [
            extract_prospect(result)
            for result in unique_results
        ]

        extracted = await asyncio.gather(*extraction_tasks)

        prospects = [p for p in extracted if p and p.get("name")]

        print("\n==============================")
        print(f"TOTAL PROSPECTS: {len(prospects)}")
        print("==============================\n")

        if not prospects:
            print("⚠️ No prospects found.")
            break

        # -----------------------------
        # STEP 4 — Score Prospects
        # -----------------------------

        print("\n🎯 Scoring prospects...\n")

        scoring_tasks = [
            score_prospect(goal, prospect)
            for prospect in prospects
        ]

        scored_results = await asyncio.gather(*scoring_tasks)

        scored_results = [
            r for r in scored_results
            if r["score"] is not None
        ]

        scored_results.sort(
            key=lambda x: x["score"],
            reverse=True
        )

        print("\n==============================")
        print("🏆 TOP SCORED PROSPECTS")
        print("==============================\n")

        for r in scored_results[:10]:
            p = r["prospect"]
            print(f"{r['score']} — {p.get('name')} ({p.get('role')})")

        # -----------------------------
        # Adaptive Loop Check
        # -----------------------------

        good_prospects = [
            r for r in scored_results
            if r["score"] >= SCORE_THRESHOLD
        ]

        print(
            f"\n⭐ Prospects scoring ≥ {SCORE_THRESHOLD}: {len(good_prospects)}"
        )

        if len(good_prospects) >= MIN_GOOD_PROSPECTS:
            print("✅ Quality threshold met.")
            break

        if retry_count >= MAX_RETRIES:
            print("⚠️ Max retries reached.")
            break

        print("\n⚡ Low quality results. Adjusting search strategy...")

        plan = await generate_campaign_plan(
            goal,
            memory_context + "\nPrevious searches returned poor results."
        )

        campaign_plan = plan.get("campaign_plan", {})
        search_queries = campaign_plan.get(
            "search_queries",
            search_queries
        )

        retry_count += 1

    # -----------------------------
    # STEP 5 — Draft Emails
    # -----------------------------

    print("\n✉️ Generating outreach emails...\n")

    tone = campaign_plan.get("tone", "friendly and professional")

    draft_tasks = [
        draft_email(
            r["prospect"],
            goal,
            tone
        )
        for r in scored_results[:10]
    ]

    emails = await asyncio.gather(*draft_tasks)

    outreach_results = []

    for i, result in enumerate(scored_results[:10]):

        outreach_results.append({
            "prospect": result["prospect"],
            "score": result["score"],
            "email": emails[i]
        })

    return {
        "prospects_found": len(prospects),
        "outreach_targets": outreach_results
    }