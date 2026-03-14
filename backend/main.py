from dotenv import load_dotenv
load_dotenv()
from backend.tools.gmail_sender import send_gmail
import traceback

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.agents.orchestrator import plan_campaign
from backend.session_store import update_session, get_session


app = FastAPI(title="Outreach AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CampaignRequest(BaseModel):
    goal: str
    session_id: str
    sender_name: str = ""
    seeking: str = ""          # ← new


class SendEmailRequest(BaseModel):
    prospect_id: int
    session_id: str


@app.get("/")
def root():
    return {"status": "Backend running"}


@app.post("/run-campaign")
async def run_campaign(data: CampaignRequest):
    print("\n▶ Starting campaign...")
    print("Goal:", data.goal)
    print("Sender:", data.sender_name, "| Seeking:", data.seeking)
    print("Session:", data.session_id[:8] + "...")

    campaign = await plan_campaign(
        goal=data.goal,
        session_id=data.session_id,
        sender_name=data.sender_name,
        seeking=data.seeking,       # ← passed through
    )

    outreach_targets = campaign.get("outreach_targets", [])

    if campaign and outreach_targets:
        update_session(
            session_id=data.session_id,
            goal=data.goal,
            new_prospects=outreach_targets
        )
        session = get_session(data.session_id)
        session["outreach_targets"] = outreach_targets

    print(f"✅ Done — {len(outreach_targets)} prospects found")

    return {
        "prospects_found": campaign.get("prospects_found", len(outreach_targets)),
        "outreach_targets": outreach_targets
    }


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

        print(f"   👤 {name} → {to_email}")

        if not to_email:
            return {"sent": False, "error": f"No email found for {name}."}

        email_draft = target.get("email", {})
        body    = email_draft.get("body", "") if isinstance(email_draft, dict) else str(email_draft)
        subject = email_draft.get("subject", "Quick hello") if isinstance(email_draft, dict) else "Quick hello"

        if not body:
            return {"sent": False, "error": "Email body is empty"}

        result = send_gmail(draft=body, to_email=to_email, subject=subject)
        print("✅ Sent!")
        return result

    except Exception as e:
        print("\n🚨 Send failed!")
        traceback.print_exc()
        return {"sent": False, "error": repr(e)}