import re
import asyncio

from backend.session_store import build_memory_context, get_session
from backend.agents.planner import generate_campaign_plan
from backend.searcher import search_web
from backend.tools.extractor import extract_prospect
from backend.tools.email_finder import find_email
from backend.tools.scorer import score_prospect
from backend.tools.drafter import draft_email


# -----------------------------
# Adaptive Loop Config
# -----------------------------

MAX_RETRIES = 2
MIN_GOOD_PROSPECTS = 5
SCORE_THRESHOLD = 60


def _profile_slug(url: str) -> str | None:
    """
    Extract the LinkedIn profile slug from a URL.
    linkedin.com/in/john-smith-123 → john-smith-123
    Handles both linkedin.com and in.linkedin.com variants.
    """
    match = re.search(r"linkedin\.com/in/([^/?#]+)", url or "")
    return match.group(1).lower() if match else None


async def plan_campaign(goal: str, session_id: str, sender_name: str = ""):

    print("\n🚀 Running campaign")
    print("Goal:", goal)
    print("Sender:", sender_name)

    memory_context = build_memory_context(session_id)
    print(memory_context)

    session = get_session(session_id)

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
    seen_slugs = set()         # deduplicate by LinkedIn profile slug
    seen_urls  = set()         # fallback dedup for non-LinkedIn URLs
    all_scored_results = []

    while True:

        print("\n==============================")
        print(f"🔎 RUNNING SEARCH QUERIES (attempt {retry_count + 1})")
        print("==============================")

        all_results = []

        for query in search_queries[:5]:
            print(f"🔍 {query}")
            results = await search_web(query)
            for r in results:
                print(r)
            all_results.extend(results)

        # Deduplicate — by profile slug first, then URL
        new_results = []
        for r in all_results:
            url  = r.get("url", "")
            slug = _profile_slug(url)

            if slug:
                if slug not in seen_slugs:
                    seen_slugs.add(slug)
                    new_results.append(r)
            else:
                if url not in seen_urls:
                    seen_urls.add(url)
                    new_results.append(r)

        print(f"\nNEW UNIQUE RESULTS THIS ROUND: {len(new_results)}")
        print(f"TOTAL SEEN SO FAR: {len(seen_slugs) + len(seen_urls)}\n")

        if not new_results:
            print("⚠️ No new results this round — skipping extract/score")
        else:
            # -----------------------------
            # STEP 4 — Extract Prospects
            # -----------------------------

            print("\n🧠 Extracting prospects...\n")

            extraction_tasks = [extract_prospect(r) for r in new_results]
            extracted = await asyncio.gather(*extraction_tasks)
            prospects = [p for p in extracted if p]

            for p in prospects:
                print("✅ Prospect:", p)

            print(f"\nPROSPECTS THIS ROUND: {len(prospects)}\n")

            if prospects:
                # -----------------------------
                # STEP 4.5 — Find Emails
                # -----------------------------

                print("\n📬 Finding emails...\n")

                async def enrich(p):
                    result = await find_email(
                        first   = p.get("first_name", ""),
                        last    = p.get("last_name", ""),
                        company = p.get("company", ""),
                        domain  = p.get("company_domain")
                    )
                    p["email"]            = result.get("email")
                    p["email_confidence"] = result.get("confidence")
                    print(f"   {p.get('name')} → {result.get('email')} [{result.get('reason')}]")
                    return p

                enriched = await asyncio.gather(*[enrich(p) for p in prospects])

                resolved   = [p for p in enriched if p.get("email")]
                unresolved = [p for p in enriched if not p.get("email")]
                print(f"✅ Emails found:  {len(resolved)}")
                print(f"❌ Unresolved:    {len(unresolved)}")

                # -----------------------------
                # STEP 5 — Score Prospects
                # -----------------------------

                print("\n🎯 Scoring prospects...\n")

                scoring_tasks = [score_prospect(goal, p) for p in enriched]
                scored = await asyncio.gather(*scoring_tasks)
                scored = [r for r in scored if r["score"] is not None]

                all_scored_results.extend(scored)

        # Sort + deduplicate by name across retries
        all_scored_results.sort(key=lambda x: x["score"], reverse=True)

        seen_names = set()
        deduped = []
        for r in all_scored_results:
            name = r["prospect"].get("name")
            if name and name not in seen_names:
                seen_names.add(name)
                deduped.append(r)
        all_scored_results = deduped

        print("\n==============================")
        print("🏆 TOP SCORED PROSPECTS (cumulative)")
        print("==============================\n")

        for r in all_scored_results[:10]:
            p = r["prospect"]
            email_status = f"📧 {p.get('email')}" if p.get("email") else "❌ no email"
            print(f"{r['score']} — {p.get('name')} ({p.get('role')}) | {email_status}")

        good_prospects = [r for r in all_scored_results if r["score"] >= SCORE_THRESHOLD]
        print(f"\n⭐ Prospects scoring ≥ {SCORE_THRESHOLD}: {len(good_prospects)}")

        if len(good_prospects) >= MIN_GOOD_PROSPECTS:
            print("✅ Quality threshold met.")
            break

        if retry_count >= MAX_RETRIES:
            print(f"⚠️ Max retries reached. Using best {len(all_scored_results)} results.")
            break

        print("\n⚡ Low quality results. Adapting search strategy...")

        feedback = """
Previous searches returned poor results.
Generate COMPLETELY DIFFERENT queries — different job titles,
different seniority levels, different industries or platforms.
Do NOT repeat any query from before.
"""

        plan = await generate_campaign_plan(goal, memory_context + "\n" + feedback)
        campaign_plan = plan.get("campaign_plan", {})
        search_queries = campaign_plan.get("search_queries", search_queries)
        retry_count += 1

        print(f"\n🔁 Retry #{retry_count}")
        print("New queries:", search_queries)

    scored_results = all_scored_results

    if not scored_results:
        print("⚠️ No prospects found.")
        return {"prospects_found": 0, "outreach_targets": []}

    # -----------------------------
    # STEP 6 — Draft Emails
    # -----------------------------

    print("\n✉️ Generating outreach emails...\n")

    tone = campaign_plan.get("tone", "friendly and professional")

    draft_tasks = [
        draft_email(r["prospect"], goal, tone, sender_name)
        for r in scored_results[:10]
    ]

    emails = await asyncio.gather(*draft_tasks)

    print(f"✅ {len(emails)} emails drafted")

    for i, email in enumerate(emails):
        prospect = scored_results[i]["prospect"]
        print("\n-----")
        print("Prospect:", prospect.get("name"))
        print("Email address:", prospect.get("email") or "not found")
        print("Subject:", email.get("subject"))
        print("Personalisation:", email.get("personalisation_used"))
        print("Word count:", email.get("word_count"))
        print("Email:")
        print(email.get("body"))

    outreach_results = []
    for i, result in enumerate(scored_results[:10]):
        outreach_results.append({
            "prospect": result["prospect"],
            "score": result["score"],
            "email": emails[i]
        })

    return {
        "prospects_found": len(scored_results),
        "outreach_targets": outreach_results
    }