import asyncio
import re
from backend.agents.planner import plan_campaign
from backend.tools.tavily_search import parallel_search, search_tavily
from backend.tools.proxycurl_enricher import enrich_linkedin_profile
from backend.tools.nova_micro_tools import (
    snippet_extractor, profile_builder, recency_detector,
    tone_analyzer, red_flag_detector, icebreaker_generator, message_drafter
)

def _profile_slug(url: str) -> str | None:
    match = re.search(r"linkedin\.com/in/([^/?#]+)", url or "")
    if match: return match.group(1).lower()
    return url  # fallback

async def _process_prospect(prospect_data, plan, log_cb, send_card_cb):
    name = prospect_data.get("name", "Unknown")
    company = prospect_data.get("company", "Unknown")
    url = prospect_data.get("url", "")
    
    await log_cb(f"[~] Cross-platform search: {name} @ {company}")
    
    # 3. Cross platform search
    platforms = plan.get("platforms", ["GitHub", "Twitter", "Medium"])
    cross_queries = [
        f"{name} {company} {plat}" for plat in platforms
    ]
    cross_results_lists = await parallel_search(cross_queries)
    cross_data = []
    found_platforms = []
    
    for i, res_list in enumerate(cross_results_lists):
        plat = platforms[i]
        if res_list:
            found_platforms.append(plat)
            cross_data.append(f"{plat}: " + " | ".join([r.get('content', '') for r in res_list[:2]]))
            await log_cb(f"[⚡] Found {plat} data for {name}")

    if url and "linkedin.com/in" in url:
        found_platforms.append("LinkedIn")

    # 4. Proxycurl enrichment
    linkedin_data = {}
    if "linkedin.com/in" in url:
        enriched = await enrich_linkedin_profile(url)
        if enriched:
            linkedin_data = enriched
            await log_cb(f"[⚡] Enriched LinkedIn data for {name}")

    # 5. Compute data richness score
    plat_count = len(set(found_platforms))
    if plat_count >= 3:
        richness = "HIGH"
    elif plat_count == 2:
        richness = "MED"
    else:
        richness = "LOW"

    # 6. Run 5 Nova Micro tools IN PARALLEL
    await log_cb(f"[~] Running 5 Micro tools for {name}...")
    try:
        results = await asyncio.gather(
            profile_builder(prospect_data, cross_data, linkedin_data),
            recency_detector(cross_data, linkedin_data),
            tone_analyzer(cross_data, linkedin_data),
            red_flag_detector(prospect_data, cross_data, linkedin_data),
            icebreaker_generator(prospect_data, cross_data, linkedin_data),
            return_exceptions=True
        )
    except Exception as e:
        await log_cb(f"[!] Tool execution failed for {name}: {e}")
        return None

    # check exceptions
    profile, recency, tone, red_flags, icebreakers = {}, {}, {}, {}, {}
    # assign if not exception
    if not isinstance(results[0], Exception): profile = results[0]
    if not isinstance(results[1], Exception): recency = results[1]
    if not isinstance(results[2], Exception): tone = results[2]
    if not isinstance(results[3], Exception): red_flags = results[3]
    if not isinstance(results[4], Exception): icebreakers = results[4]

    score = profile.get("relevance_score", 0)
    await log_cb(f"[⚡] Tone: {tone.get('style', 'neutral')}")
    await log_cb(f"[⚡] Red flags: {len(red_flags.get('flags', []))}")

    # 7. Message Drafter
    try:
        drafts = await message_drafter(
            goal=plan.get("goal", ""),
            plan=plan,
            profile=profile,
            recency=recency,
            tone=tone,
            icebreakers=icebreakers
        )
    except Exception as e:
        await log_cb(f"[!] Draft failed for {name}: {e}")
        drafts = {}

    card = {
        "slug": _profile_slug(url),
        "name": profile.get("name", name),
        "role": profile.get("role", "Unknown"),
        "company": profile.get("company", company),
        "location": profile.get("location", "Unknown"),
        "url": url,
        "richness": richness,
        "score": score,
        "match_reason": profile.get("match_reason", "Candidate matches goal criteria"),
        "platforms": found_platforms,
        "profile": profile,
        "recency": recency.get("signals", []),
        "tone": tone,
        "red_flags": red_flags.get("flags", []),
        "icebreakers": icebreakers.get("icebreakers", []),
        "drafts": drafts
    }

    await log_cb(f"[✓] Card ready: {card['name']} (score {score})")
    await send_card_cb(card)
    
    return card

async def run_pipeline(goal: str, session: dict, log_cb, send_card_cb, lead_count: int = 10):
    previous_queries = session.get("used_queries", [])
    
    retry_count = 0
    while retry_count < 2:
        await log_cb(f"[→] Nova Pro planning campaign (Attempt {retry_count+1})...")
        plan = await plan_campaign(goal, previous_queries)
        plan["goal"] = goal
        
        queries = plan.get("search_queries", [])
        if not queries:
            await log_cb("[✗] No search queries generated!")
            break
            
        await log_cb(f"[→] Strategy: {', '.join(plan.get('platforms', ['LinkedIn']))} search")
        await log_cb(f"[~] Running {len(queries)} Tavily queries in parallel...")
        
        raw_results = await parallel_search(queries)
        session["used_queries"] = previous_queries + queries
        
        flattened = [item for sublist in raw_results for item in sublist]
        await log_cb(f"[⚡] {len(flattened)} raw results returned, deduplicating...")
        
        # dedup by slug
        seen = set()
        deduped = []
        for r in flattened:
            slug = _profile_slug(r.get("url"))
            if slug and slug not in seen:
                seen.add(slug)
                deduped.append(r)
                
        if not deduped:
            await log_cb(f"[!] No unique prospects found on attempt {retry_count+1}")
            retry_count += 1
            if retry_count < 2:
                await log_cb("[→] Replanning with different queries...")
            continue
            
        await log_cb(f"[~] Extracting name+company for {len(deduped)} prospects...")
        
        def safe_extract(r):
            return snippet_extractor(r.get("content", ""))
            
        extraction_tasks = [safe_extract(r) for r in deduped]
        extractions = await asyncio.gather(*extraction_tasks, return_exceptions=True)
        
        prospects = []
        for i, res in enumerate(extractions):
            if not isinstance(res, Exception):
                p = deduped[i]
                p["name"] = res.get("name")
                p["company"] = res.get("company")
                prospects.append(p)
                
        # Now process all concurrently, but cap concurrency to avoid rate limits
        tasks = []
        for p in prospects[:lead_count]: # Process max lead_count to keep it demoable
            tasks.append(_process_prospect(p, plan, log_cb, send_card_cb))
            
        await log_cb(f"[~] Generating profiles and dispatching micro-agents...")
        finished = await asyncio.gather(*tasks)
        
        good_cards = [c for c in finished if c and c.get("score", 0) >= 60]
        
        if len(good_cards) < 5 and retry_count == 0:
            await log_cb(f"[!] Only {len(good_cards)} scored >= 60. Adaptive Replanning...")
            retry_count += 1
        else:
            await log_cb(f"[✓] Campaign complete! {len(good_cards)} high-quality prospects found.")
            break
            
    return True