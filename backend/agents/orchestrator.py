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
    print(memory_context)

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

    # -----------------------------
    # ADAPTIVE SEARCH LOOP
    # -----------------------------

    retry_count = 0

    while True:

        print("\n==============================")
        print("🔎 RUNNING SEARCH QUERIES")
        print("==============================")

        all_results = []

        for query in search_queries[:5]:
            print(f"🔍 {query}")

            results = await search_web(query)

            for r in results:
                print(r)

            all_results.extend(results)

        # -----------------------------
        # Deduplicate URLs
        # -----------------------------

        seen = set()
        unique_results = []

        for r in all_results:
            url = r["url"]

            if url not in seen:
                seen.add(url)
                unique_results.append(r)

        print("\n==============================")
        print(f"TOTAL UNIQUE RESULTS: {len(unique_results)}")
        print("==============================\n")

        # -----------------------------
        # STEP 4 — Extract Prospects
        # -----------------------------

        print("\n🧠 Extracting prospects...\n")

        extraction_tasks = [
            extract_prospect(result)
            for result in unique_results
        ]

        extracted = await asyncio.gather(*extraction_tasks)

        prospects = [p for p in extracted if p]

        for p in prospects:
            print("✅ Prospect:", p)

        print("\n==============================")
        print(f"TOTAL PROSPECTS: {len(prospects)}")
        print("==============================\n")

        if not prospects:
            prospects = []

        # -----------------------------
        # STEP 5 — Score Prospects
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

            print(
                f"{r['score']} — {p.get('name')} ({p.get('role')})"
            )

        # -----------------------------
        # Adaptive Quality Check
        # -----------------------------

        good_prospects = [
            r for r in scored_results
            if r["score"] >= SCORE_THRESHOLD
        ]

        print(
            f"\n⭐ Prospects scoring ≥ {SCORE_THRESHOLD}: {len(good_prospects)}"
        )

        # SUCCESS CONDITION
        if len(good_prospects) >= MIN_GOOD_PROSPECTS:
            print("✅ Quality threshold met.")
            break

        # RETRY CAP
        if retry_count >= MAX_RETRIES:
            print("⚠️ Max retries reached. Continuing with current results.")
            break

        # ADAPT STRATEGY
        print("\n⚡ Low quality results detected. Adapting search strategy...")

        feedback = """
Previous searches returned poor results.
Adjust strategy with different queries,
broader keywords and possibly different platforms.
"""

        plan = await generate_campaign_plan(
            goal,
            memory_context + "\n" + feedback
        )

        campaign_plan = plan.get("campaign_plan", {})

        search_queries = campaign_plan.get(
            "search_queries",
            search_queries
        )

        retry_count += 1

        print(f"\n🔁 Retry #{retry_count}")
        print("New queries:", search_queries)

    # -----------------------------
    # STEP 6 — Draft Emails
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

    print(f"✅ {len(emails)} emails drafted")

    for i, email in enumerate(emails):

        prospect = scored_results[i]["prospect"]

        print("\n-----")
        print("Prospect:", prospect.get("name"))
        print("Subject:", email.get("subject"))
        print("Word count:", email.get("word_count"))
        print("Email:")
        print(email.get("body"))

    # -----------------------------
    # Final Output
    # -----------------------------

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