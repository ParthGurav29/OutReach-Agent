import asyncio
import json
import traceback
from typing import AsyncGenerator
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.agents.orchestrator import run_pipeline
app = FastAPI(title="ReachAgent — Antigravity Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────
# Session Memory (In-Memory Dictionary)
# ─────────────────────────────────────────────────────────────────
_sessions = {}

def get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "used_queries": [],
            "prospects": []
        }
    return _sessions[session_id]

# ─────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────
class CampaignRequest(BaseModel):
    goal: str
    session_id: str
    lead_count: int = 10
    sender_details: dict = {}

# ─────────────────────────────────────────────────────────────────
# Request Queues for SSE
# ─────────────────────────────────────────────────────────────────
_queues = {}

def get_queue(session_id: str) -> asyncio.Queue:
    if session_id not in _queues:
        _queues[session_id] = asyncio.Queue()
    return _queues[session_id]

async def _sse_generator(session_id: str) -> AsyncGenerator[str, None]:
    queue = get_queue(session_id)
    while True:
        try:
            msg = await asyncio.wait_for(queue.get(), timeout=60)
            if msg == "__DONE__":
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break
            # msg is a dict we can serialize
            yield f"data: {json.dumps(msg)}\n\n"
        except asyncio.TimeoutError:
            yield "data: {\"type\": \"keepalive\"}\n\n"

@app.get("/stream-campaign")
async def stream_campaign(session_id: str):
    return StreamingResponse(
        _sse_generator(session_id),
        media_type="text/event-stream"
    )

@app.post("/run-campaign")
async def run_campaign_api(data: CampaignRequest):
    if not data.goal.strip():
        return {"error": "Empty goal."}
        
    session = get_session(data.session_id)
    queue = get_queue(data.session_id)
    
    async def log_cb(msg: str):
        print(msg)
        await queue.put({"type": "log", "content": msg})
        
    async def send_card_cb(card: dict):
        session["prospects"].append(card)
        await queue.put({"type": "card", "content": card})
        
    async def _run():
        try:
            await run_pipeline(data.goal, session, log_cb, send_card_cb, data.lead_count, data.sender_details)
        except Exception as e:
            traceback.print_exc()
            await log_cb(f"[✗] Pipeline Error: {e}")
        finally:
            await queue.put("__DONE__")
            
    # Run in background to let HTTP request return immediately
    asyncio.create_task(_run())
    return {"status": "started"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)





@app.get("/")
def root():
    return {"status": "Outreach Agent backend running"}