from dotenv import load_dotenv
load_dotenv()
from backend.tools.gmail_sender import send_gmail
import base64
import pickle
import traceback
from datetime import datetime
from email.mime.text import MIMEText

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from googleapiclient.discovery import build

from backend.agents.orchestrator import plan_campaign
from backend.session_store import update_session, get_session


app = FastAPI(title="Outreach AI Agent")


# -----------------------------
# CORS
# -----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Request Models
# -----------------------------

class AnalyzeRequest(BaseModel):
    company: str
    website: str | None = None


class SendRequest(BaseModel):
    name: str
    email: str
    company: str
    message: str


class CampaignRequest(BaseModel):
    goal: str
    session_id: str


class SendEmailRequest(BaseModel):
    prospect_id: int
    session_id: str


# -----------------------------
# Root endpoint
# -----------------------------

@app.get("/")
def root():
    return {"status": "Backend running"}


# -----------------------------
# Analyze endpoint
# -----------------------------

@app.post("/analyze")
def analyze_lead(data: AnalyzeRequest):

    return {
        "company": data.company,
        "insight": "Company research placeholder",
        "status": "analysis_complete"
    }


# -----------------------------
# Send endpoint (placeholder)
# -----------------------------

@app.post("/send")
def send_email(data: SendRequest):

    return {
        "email": data.email,
        "status": "email_sent_simulation",
        "message": data.message
    }


# -----------------------------
# Run Campaign endpoint
# -----------------------------

@app.post("/run-campaign")
async def run_campaign(data: CampaignRequest):

    print("\n▶ Starting campaign...")
    print("Goal:", data.goal)
    print("Session:", data.session_id[:8] + "...")

    campaign = await plan_campaign(
        goal=data.goal,
        session_id=data.session_id
    )

    # store results in session memory
    if campaign and "outreach_targets" in campaign:
        update_session(
            session_id=data.session_id,
            goal=data.goal,
            new_prospects=campaign["outreach_targets"] # Reverted back to avoid the TypeError
        )

    print(f"✅ Done — {len(campaign.get('outreach_targets', []))} prospects found")

    return {
        "prospects_found": len(campaign.get("outreach_targets", [])),
        "outreach_targets": campaign.get("outreach_targets", [])
    }


# -----------------------------
# Send Email via Gmail endpoint
# -----------------------------

@app.post("/send-email")
def send_email_via_gmail(data: SendEmailRequest):
    import traceback
    try:
        print(f"\n📤 [START] Sending email to prospect #{data.prospect_id}...")
        
        session = get_session(data.session_id)
        prospects = session.get("outreach_targets", [])

        if data.prospect_id >= len(prospects):
            return {"sent": False, "error": f"Invalid ID. Total prospects: {len(prospects)}"}

        prospect = prospects[data.prospect_id]
        print(f"   🔍 [DEBUG] Prospect Data Type: {type(prospect)}")

        email_data = prospect.get("email")
        if not email_data:
            return {"sent": False, "error": "No email draft found"}

        # Safely extract draft whether it's a string or dictionary
        if isinstance(email_data, dict):
            draft = email_data.get("body", str(email_data))
        else:
            draft = str(email_data)
            
        print(f"   📝 [DEBUG] Draft extracted (length: {len(draft)} chars)")

        # Trigger the sender
        result = send_gmail(
            draft=draft,
            to_email="337.parth.gurav@gmail.com"
        )

        print("✅ [SUCCESS] Email sent successfully!")
        return result

    except Exception as e:
        print("\n🚨 [CRITICAL ERROR] Email send failed!")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {repr(e)}")  # repr() forces the error text to be visible
        print("--- Full Traceback ---")
        traceback.print_exc()
        print("------------------------------------------\n")
        
        return {
            "sent": False,
            "error": repr(e)
        }