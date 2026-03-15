from dotenv import load_dotenv
load_dotenv()

import asyncio
import json
import math
import traceback
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.agents.orchestrator import plan_campaign
from backend.session_store import update_session, get_session
from backend.tools.gmail_sender import send_gmail


app = FastAPI(title="LinkedIn Outreach AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────────

class CampaignRequest(BaseModel):
    goal: str
    session_id: str
    sender_name: str = ""
    seeking: str = ""


class SendEmailRequest(BaseModel):
    prospect_id: int
    session_id: str
    subject: str = None
    body: str = None


class LaunchCampaignRequest(BaseModel):
    session_id: str
    prospect_ids: list[int] = []   # which prospects to warm up (empty = all)


# ─────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "LinkedIn Outreach Agent — running"}


# ─────────────────────────────────────────────────────────────────
# SSE Live-Log Stream  (/stream-campaign)
# ─────────────────────────────────────────────────────────────────

# In-memory queues keyed by session_id — a simple pub/sub for SSE
_log_queues: dict[str, asyncio.Queue] = {}
_SENTINEL = "__DONE__"


def _get_queue(session_id: str) -> asyncio.Queue:
    if session_id not in _log_queues:
        _log_queues[session_id] = asyncio.Queue()
    return _log_queues[session_id]


async def _sse_generator(session_id: str) -> AsyncGenerator[str, None]:
    queue = _get_queue(session_id)
    while True:
        try:
            message = await asyncio.wait_for(queue.get(), timeout=60)
        except asyncio.TimeoutError:
            yield "data: __KEEPALIVE__\n\n"
            continue

        if message == _SENTINEL:
            yield f"data: {json.dumps({'log': '__DONE__'})}\n\n"
            break

        yield f"data: {json.dumps({'log': message})}\n\n"


@app.get("/stream-campaign")
async def stream_campaign_logs(session_id: str):
    """
    Server-Sent Events endpoint. Frontend connects before calling /run-campaign,
    then receives live log lines as they happen in the pipeline.
    """
    return StreamingResponse(
        _sse_generator(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─────────────────────────────────────────────────────────────────
# Main Campaign Endpoint  (/run-campaign)
# ─────────────────────────────────────────────────────────────────

@app.post("/run-campaign")
async def run_campaign(data: CampaignRequest, page: int = 1, limit: int = 10):
    print(f"\n▶ LinkedIn campaign starting | session={data.session_id[:8]}...")
    print(f"   Goal: {data.goal}")
    print(f"   Sender: {data.sender_name} | Seeking: {data.seeking}")
    print(f"   Pagination: page {page}, limit {limit}")

    session = get_session(data.session_id)
    queue   = _get_queue(data.session_id)

    async def push_log(msg: str):
        await queue.put(msg)

    # ── Cache check ──────────────────────────────────────────────
    is_pagination = (
        session.get("last_goal") == data.goal
        and session.get("outreach_targets")
    )

    if is_pagination:
        print("🔄 Serving cached results for pagination")
        all_targets     = session["outreach_targets"]
        prospects_found = session.get("prospects_found", len(all_targets))
    else:
        # ── Run pipeline ─────────────────────────────────────────
        try:
            campaign = await plan_campaign(
                goal         = data.goal,
                session_id   = data.session_id,
                sender_name  = data.sender_name,
                seeking      = data.seeking,
                log_callback = push_log,
            )
        finally:
            # Signal SSE stream to close
            await queue.put(_SENTINEL)

        all_targets     = campaign.get("outreach_targets", [])
        prospects_found = campaign.get("prospects_found", len(all_targets))

        session["last_goal"]        = data.goal
        session["outreach_targets"] = all_targets
        session["prospects_found"]  = prospects_found

        if all_targets:
            update_session(
                session_id    = data.session_id,
                goal          = data.goal,
                new_prospects = all_targets,
            )

    # ── Paginate ─────────────────────────────────────────────────
    total_leads = len(all_targets)
    total_pages = math.ceil(total_leads / limit) if total_leads > 0 else 1
    page        = max(1, min(page, total_pages))
    start_idx   = (page - 1) * limit
    paginated   = all_targets[start_idx: start_idx + limit]

    print(f"✅ Returning page {page}/{total_pages} ({len(paginated)} leads)")

    return {
        "prospects_found":   prospects_found,
        "outreach_targets":  paginated,
        "total_leads_count": total_leads,
        "current_page":      page,
        "total_pages_count": total_pages,
    }


# ─────────────────────────────────────────────────────────────────
# Send Email (legacy / fallback channel)
# ─────────────────────────────────────────────────────────────────

@app.post("/send-email")
def send_email_via_gmail(data: SendEmailRequest):
    try:
        print(f"\n📤 Sending email to prospect #{data.prospect_id}...")
        session = get_session(data.session_id)
        targets = session.get("outreach_targets", [])

        if data.prospect_id >= len(targets):
            return {"sent": False, "error": f"Invalid prospect_id. Only {len(targets)} in session."}

        target   = targets[data.prospect_id]
        prospect = target.get("prospect", {})
        to_email = prospect.get("email")
        name     = prospect.get("name", "there")

        if not to_email:
            return {"sent": False, "error": f"No email found for {name}."}

        email_draft = target.get("email", {})
        body        = data.body    or (email_draft.get("body",    "") if isinstance(email_draft, dict) else str(email_draft))
        subject     = data.subject or (email_draft.get("subject", "Quick hello") if isinstance(email_draft, dict) else "Quick hello")

        if not body:
            return {"sent": False, "error": "Email body is empty"}

        result = send_gmail(draft=body, to_email=to_email, subject=subject)
        return result

    except Exception as e:
        traceback.print_exc()
        return {"sent": False, "error": repr(e)}


# ─────────────────────────────────────────────────────────────────
# Launch Campaign — Playwright Warm-Up  (/launch-campaign)
# ─────────────────────────────────────────────────────────────────

async def _playwright_warmup_sequence(targets: list, log_queue: asyncio.Queue):
    """
    Mocked Playwright warm-up sequence.
    Replace the individual action stubs with real Playwright calls.
    """
    await log_queue.put(f"🚀 Launch Campaign — Warm-Up Sequence started")
    await log_queue.put(f"🔍 Warming {len(targets)} profiles...")
    await asyncio.sleep(0.4)

    for i, t in enumerate(targets[:10]):   # Cap at 10 to avoid rate limits
        name    = t.get("prospect", {}).get("name", f"Prospect #{i+1}")
        li_url  = t.get("prospect", {}).get("linkedin_url", "")
        cadence = t.get("cadence", {})

        # Touch 1 — View profile
        await log_queue.put(f"👁  Viewing profile: {name}")
        await asyncio.sleep(0.3)

        # Touch 2 — Like a post (mocked)
        await log_queue.put(f"👍 Liked a recent post by {name}")
        await asyncio.sleep(0.2)

        # Touch 3 — Send connection request (mocked)
        await log_queue.put(f"📩 Connection request sent to {name}")
        await asyncio.sleep(0.25)

        # Update cadence step to "Connection Sent" (step index 2)
        if cadence:
            cadence["current_step"]   = 2
            cadence["current_status"] = "Day 2: Connection Sent"

    await asyncio.sleep(0.3)
    await log_queue.put(f"⏳ Day 4 DMs queued for {min(len(targets), 10)} prospects...")
    await log_queue.put("✅ Warm-Up Sequence complete! Monitor cadence dashboard for follow-ups.")
    await log_queue.put(_SENTINEL)


@app.post("/launch-campaign")
async def launch_campaign(data: LaunchCampaignRequest):
    """
    Triggers the Playwright warm-up automation and streams logs via SSE.
    """
    print(f"\n🚀 Launching campaign for session {data.session_id[:8]}...")
    session = get_session(data.session_id)
    targets = session.get("outreach_targets", [])

    if not targets:
        return {"launched": False, "error": "No prospects in session. Run campaign first."}

    # Filter to requested IDs if specified
    if data.prospect_ids:
        targets = [t for i, t in enumerate(targets) if i in data.prospect_ids]

    queue = _get_queue(data.session_id)

    # Run warm-up in background so endpoint returns immediately
    asyncio.create_task(_playwright_warmup_sequence(targets, queue))

    return {
        "launched":       True,
        "warming_up":     min(len(targets), 10),
        "total_prospects": len(targets),
        "message":        "Warm-up sequence started. Watch the live terminal for updates.",
    }


# ─────────────────────────────────────────────────────────────────
# Cadence Advance  (/advance-cadence)
# ─────────────────────────────────────────────────────────────────

class AdvanceCadenceRequest(BaseModel):
    session_id:  str
    prospect_id: int


@app.post("/advance-cadence")
async def advance_cadence(data: AdvanceCadenceRequest):
    """Move a prospect's 7-touch cadence one step forward."""
    session = get_session(data.session_id)
    targets = session.get("outreach_targets", [])

    if data.prospect_id >= len(targets):
        return {"error": "Invalid prospect_id"}

    cadence = targets[data.prospect_id].get("cadence", {})
    steps   = cadence.get("steps", [])
    current = cadence.get("current_step", 0)

    if current < len(steps) - 1:
        current += 1
        cadence["current_step"]   = current
        cadence["current_status"] = steps[current]["status"]
        cadence["completed"]      = current == len(steps) - 1

    return {
        "prospect_id":    data.prospect_id,
        "new_status":     cadence.get("current_status"),
        "completed":      cadence.get("completed", False),
    }