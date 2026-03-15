"""
orchestrator.py — LinkedIn Campaign Orchestrator
-------------------------------------------------
Pipeline:
  1. Plan → generate search queries
  2. Search → Tavily (LinkedIn-first)
  3. Dedup by LinkedIn slug
  4. Extract → prospect info + linkedin_url
  5. Find emails (fallback channel)
  6. Score → quality filter
  7. Draft → CCQ LinkedIn DMs (personalisation from Tavily snippets)
  8. Attach 7-touch cadence tracker per prospect
"""

import re
import asyncio

from backend.session_store import build_memory_context, get_session
from backend.agents.planner import generate_campaign_plan
from backend.searcher import search_web
from backend.tools.extractor import extract_prospect
from backend.tools.email_finder import find_email
from backend.tools.scorer import score_prospect
from backend.tools.drafter import draft_email


MAX_RETRIES        = 2
MIN_GOOD_PROSPECTS = 5
SCORE_THRESHOLD    = 60


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

async def async_gather_chunks(coros, chunk_size=5):
    results = []
    for i in range(0, len(coros), chunk_size):
        chunk = coros[i:i + chunk_size]
        results.extend(await asyncio.gather(*chunk, return_exceptions=True))
    # Filter out exceptions silently
    return [r for r in results if not isinstance(r, Exception)]


def _profile_slug(url: str) -> str | None:
    match = re.search(r"linkedin\.com/in/([^/?#]+)", url or "")
    return match.group(1).lower() if match else None


# ─────────────────────────────────────────────────────────────────
# 7-Touch Cadence Tracker
# ─────────────────────────────────────────────────────────────────

CADENCE_STEPS = [
    {"day": 0,  "touch": 1, "action": "Profile Viewed",        "status": "Day 0: Profile Viewed"},
    {"day": 1,  "touch": 2, "action": "Post Liked",            "status": "Day 1: Post Liked"},
    {"day": 2,  "touch": 3, "action": "Connection Sent",       "status": "Day 2: Connection Sent"},
    {"day": 4,  "touch": 4, "action": "DM 1 Queued",           "status": "Day 4: DM 1 Queued"},
    {"day": 7,  "touch": 5, "action": "Follow-up DM Queued",   "status": "Day 7: Follow-up DM Queued"},
    {"day": 12, "touch": 6, "action": "Value Post Reaction",   "status": "Day 12: Value Post Reaction"},
    {"day": 14, "touch": 7, "action": "Final DM Queued",       "status": "Day 14: Final DM Queued"},
]


def build_cadence(prospect_name: str) -> dict:
    """Returns a 7-touch cadence dict for a prospect, starting at step 0."""
    return {
        "current_step": 0,
        "current_status": CADENCE_STEPS[0]["status"],
        "steps": CADENCE_STEPS,
        "completed": False,
    }


# ─────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────

async def plan_campaign(
    goal: str,
    session_id: str,
    sender_name: str = "",
    seeking: str = "",
    log_callback=None,
):
    """
    Runs the full LinkedIn outreach pipeline.
    `log_callback` is an optional async callable(str) for live log streaming.
    """

    async def log(msg: str):
        print(msg)
        if log_callback:
            try:
                await log_callback(msg)
            except Exception:
                pass

    await log("\n🚀 Running LinkedIn campaign")
    await log(f"Goal: {goal}")
    await log(f"Sender: {sender_name} | Seeking: {seeking}")

    memory_context = build_memory_context(session_id)
    session        = get_session(session_id)

    # ── STEP 1: Plan ────────────────────────────────────────────
    plan = await generate_campaign_plan(goal, memory_context)

    if not plan or "campaign_plan" not in plan:
        await log("⚠️ No campaign plan generated")
        return {}

    campaign_plan  = plan["campaign_plan"]
    search_queries = campaign_plan.get("search_queries", [])

    if not search_queries:
        await log("⚠️ No search queries generated")
        return {}

    retry_count        = 0
    seen_slugs         = set()
    seen_urls          = set()
    all_scored_results = []

    while True:
        await log(f"\n🔎 SEARCH ATTEMPT {retry_count + 1}")

        # ── STEP 2: Search ──────────────────────────────────────
        all_results = []
        for query in search_queries[:5]:
            await log(f"🔍 Searching: {query}")
            results = await search_web(query)
            all_results.extend(results)

        # ── STEP 3: Dedup ───────────────────────────────────────
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

        await log(f"📋 {len(new_results)} new unique profiles found")

        if not new_results:
            await log("⚠️ No new results — skipping extraction")
        else:
            # ── STEP 4: Extract ─────────────────────────────────
            await log("🧠 Extracting prospect data...")
            extracted = await async_gather_chunks(
                [extract_prospect(r) for r in new_results], chunk_size=5
            )
            prospects = [p for p in extracted if p]
            await log(f"✅ {len(prospects)} prospects extracted")

            if prospects:
                # ── Map contact_url → linkedin_url ─────────────────
                for p in prospects:
                    if not p.get("linkedin_url"):
                        contact = p.pop("contact_url", None) or p.get("url", "")
                        p["linkedin_url"] = contact

                # ── STEP 4.6: Email discovery (for fallback) ───
                await log("📬 Finding emails (fallback channel)...")

                async def find_email_for(p):
                    result = await find_email(
                        first   = p.get("first_name", ""),
                        last    = p.get("last_name", ""),
                        company = p.get("company", ""),
                        domain  = p.get("company_domain"),
                    )
                    p["email"]            = result.get("email")
                    p["email_confidence"] = result.get("confidence")
                    await log(f"   📧 {p.get('name')} → {result.get('email') or 'not found'}")
                    return p

                enriched = await async_gather_chunks(
                    [find_email_for(p) for p in prospects], chunk_size=5
                )

                # ── STEP 5: Score ───────────────────────────────
                await log("🎯 Scoring prospects...")
                scored = await async_gather_chunks(
                    [score_prospect(goal, p) for p in enriched], chunk_size=5
                )
                scored = [r for r in scored if isinstance(r, dict) and r.get("score") is not None]
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

        good = [r for r in all_scored_results if r["score"] >= SCORE_THRESHOLD]
        await log(f"⭐ {len(good)} prospects above score threshold ({SCORE_THRESHOLD})")

        if len(good) >= MIN_GOOD_PROSPECTS:
            await log("✅ Quality threshold met.")
            break

        if retry_count >= MAX_RETRIES:
            await log(f"⚠️ Max retries reached — proceeding with {len(all_scored_results)} prospects")
            break

        await log("\n⚡ Adapting search strategy...")
        feedback       = "\nPrevious searches returned poor results. Generate COMPLETELY DIFFERENT queries.\n"
        plan           = await generate_campaign_plan(goal, memory_context + feedback)
        campaign_plan  = plan.get("campaign_plan", {})
        search_queries = campaign_plan.get("search_queries", search_queries)
        retry_count   += 1
        await log(f"🔁 Retry #{retry_count}")

    scored_results = all_scored_results

    if not scored_results:
        return {"prospects_found": 0, "outreach_targets": []}

    # ── STEP 7: Draft LinkedIn DMs ───────────────────────────────
    await log(f"\n💬 Drafting LinkedIn DMs for {len(scored_results)} prospects...")
    tone = campaign_plan.get("tone", "friendly and professional")

    async def draft_for(r):
        return await draft_email(
            prospect    = r["prospect"],
            goal        = goal,
            tone        = tone,
            sender_name = sender_name,
            seeking     = seeking,
        )

    dms = await async_gather_chunks([draft_for(r) for r in scored_results], chunk_size=5)
    await log(f"✅ {len(dms)} LinkedIn DMs drafted")

    # ── STEP 7: Attach 7-touch cadence ──────────────────────────
    await log("📅 Building 7-touch cadence trackers...")

    outreach_results = []
    for i, dm in enumerate(dms):
        prospect = scored_results[i]["prospect"]
        cadence  = build_cadence(prospect.get("name", ""))
        outreach_results.append({
            "prospect": prospect,
            "score":    scored_results[i]["score"],
            "email":    dm,        # kept as "email" for UI compatibility
            "cadence":  cadence,
        })
        await log(f"📩 Queued: {prospect.get('name')} — {cadence['current_status']}")

    await log(f"\n🎉 Campaign ready! {len(outreach_results)} prospects in 7-touch cadence.")

    return {
        "prospects_found":  len(scored_results),
        "outreach_targets": outreach_results,
    }