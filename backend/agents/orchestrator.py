import re
import asyncio

from backend.session_store import build_memory_context, get_session
from backend.agents.planner import generate_campaign_plan
from backend.searcher import search_web
from backend.tools.extractor import extract_prospect
from backend.tools.email_finder import find_email
from backend.tools.scorer import score_prospect
from backend.tools.drafter import draft_email


MAX_RETRIES    = 2
MIN_GOOD_PROSPECTS = 5
SCORE_THRESHOLD    = 60


def _profile_slug(url: str) -> str | None:
    match = re.search(r"linkedin\.com/in/([^/?#]+)", url or "")
    return match.group(1).lower() if match else None


async def plan_campaign(goal: str, session_id: str, sender_name: str = "", seeking: str = ""):

    print("\n🚀 Running campaign")
    print("Goal:", goal)
    print("Sender:", sender_name, "| Seeking:", seeking)

    memory_context = build_memory_context(session_id)
    session = get_session(session_id)

    # STEP 1 — Plan
    plan = await generate_campaign_plan(goal, memory_context)

    if not plan or "campaign_plan" not in plan:
        print("⚠️ No campaign plan generated")
        return {}

    campaign_plan  = plan["campaign_plan"]
    search_queries = campaign_plan.get("search_queries", [])

    if not search_queries:
        print("⚠️ No search queries generated")
        return {}

    retry_count        = 0
    seen_slugs         = set()
    seen_urls          = set()
    all_scored_results = []

    while True:

        print(f"\n==============================")
        print(f"🔎 SEARCH QUERIES (attempt {retry_count + 1})")
        print("==============================")

        all_results = []
        for query in search_queries[:5]:
            print(f"🔍 {query}")
            results = await search_web(query)
            for r in results:
                print(r)
            all_results.extend(results)

        # Dedup by LinkedIn slug, fallback to URL
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

        print(f"\nNEW UNIQUE: {len(new_results)} | TOTAL SEEN: {len(seen_slugs) + len(seen_urls)}\n")

        if not new_results:
            print("⚠️ No new results — skipping")
        else:
            # STEP 4 — Extract
            print("\n🧠 Extracting prospects...\n")
            extracted = await asyncio.gather(*[extract_prospect(r) for r in new_results])
            prospects = [p for p in extracted if p]

            for p in prospects:
                print("✅", p)

            print(f"\nPROSPECTS: {len(prospects)}\n")

            if prospects:
                # STEP 4.5 — Find emails
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
                print(f"✅ Emails found: {len(resolved)} | ❌ Unresolved: {len(unresolved)}")

                # STEP 5 — Score
                print("\n🎯 Scoring...\n")
                scored = await asyncio.gather(*[score_prospect(goal, p) for p in enriched])
                scored = [r for r in scored if r["score"] is not None]
                all_scored_results.extend(scored)

        # Sort + dedup by name
        all_scored_results.sort(key=lambda x: x["score"], reverse=True)
        seen_names = set()
        deduped    = []
        for r in all_scored_results:
            name = r["prospect"].get("name")
            if name and name not in seen_names:
                seen_names.add(name)
                deduped.append(r)
        all_scored_results = deduped

        print("\n🏆 TOP PROSPECTS\n")
        for r in all_scored_results:
            p = r["prospect"]
            email_tag = f"📧 {p.get('email')}" if p.get("email") else "❌ no email"
            print(f"{r['score']} — {p.get('name')} ({p.get('role')}) | {email_tag}")

        good = [r for r in all_scored_results if r["score"] >= SCORE_THRESHOLD]
        print(f"\n⭐ Scoring ≥ {SCORE_THRESHOLD}: {len(good)}")

        if len(good) >= MIN_GOOD_PROSPECTS:
            print("✅ Quality threshold met.")
            break

        if retry_count >= MAX_RETRIES:
            print(f"⚠️ Max retries reached.")
            break

        print("\n⚡ Adapting strategy...")
        feedback = "\nPrevious searches returned poor results. Generate COMPLETELY DIFFERENT queries.\n"
        plan = await generate_campaign_plan(goal, memory_context + feedback)
        campaign_plan  = plan.get("campaign_plan", {})
        search_queries = campaign_plan.get("search_queries", search_queries)
        retry_count   += 1
        print(f"🔁 Retry #{retry_count} | Queries: {search_queries}")

    scored_results = all_scored_results

    if not scored_results:
        return {"prospects_found": 0, "outreach_targets": []}

    # STEP 6 — Draft emails
    print("\n✉️ Drafting emails...\n")
    tone = campaign_plan.get("tone", "friendly and professional")

    emails = await asyncio.gather(*[
        draft_email(r["prospect"], goal, tone, sender_name, seeking)
        for r in scored_results
    ])

    print(f"✅ {len(emails)} emails drafted")

    for i, email in enumerate(emails):
        p = scored_results[i]["prospect"]
        print(f"\n-----")
        print(f"Prospect: {p.get('name')} | Email: {p.get('email') or 'not found'}")
        print(f"Subject: {email.get('subject')}")
        print(f"Personalisation: {email.get('personalisation_used')}")
        print(f"Word count: {email.get('word_count')}")
        print(email.get("body"))

    outreach_results = [
        {"prospect": scored_results[i]["prospect"], "score": scored_results[i]["score"], "email": emails[i]}
        for i in range(len(emails))
    ]

    return {
        "prospects_found": len(scored_results),
        "outreach_targets": outreach_results
    }