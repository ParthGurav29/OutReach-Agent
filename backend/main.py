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
    subject: str = None
    body: str = None


@app.get("/")
def root():
    return {"status": "Backend running"}


@app.post("/run-campaign")
async def run_campaign(data: CampaignRequest, page: int = 1, limit: int = 10):
    print("\n▶ Starting campaign...")
    print("Goal:", data.goal)
    print("Sender:", data.sender_name, "| Seeking:", data.seeking)
    print("Session:", data.session_id[:8] + "...")
    print(f"Pagination: page {page}, limit {limit}")

    session = get_session(data.session_id)

    # Check if this is a pagination request for the EXACT SAME goal
    is_pagination = False
    
    if session.get("last_goal") == data.goal and session.get("outreach_targets"):
        print(f"🔄 Request identical to last run -> serving cached results for pagination")
        is_pagination = True
        all_targets = session["outreach_targets"]
        prospects_found = session.get("prospects_found", len(all_targets))
    else:
        # Run new pipeline
        campaign = await plan_campaign(
            goal=data.goal,
            session_id=data.session_id,
            sender_name=data.sender_name,
            seeking=data.seeking,
        )
        all_targets = campaign.get("outreach_targets", [])
        prospects_found = campaign.get("prospects_found", len(all_targets))
        
        session["last_goal"] = data.goal
        session["outreach_targets"] = all_targets
        session["prospects_found"] = prospects_found
        
        if all_targets:
            update_session(
                session_id=data.session_id,
                goal=data.goal,
                new_prospects=all_targets
            )

    # Calculate pagination
    total_leads = len(all_targets)
    import math
    total_pages = math.ceil(total_leads / limit) if total_leads > 0 else 1
    
    if page < 1:
        page = 1
    elif page > total_pages and total_pages > 0:
        page = total_pages
        
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_targets = all_targets[start_idx:end_idx]

    print(f"✅ Returning page {page}/{total_pages} (leads {start_idx}-{end_idx} of {total_leads})")

    return {
        "prospects_found": prospects_found,
        "outreach_targets": paginated_targets,
        "total_leads_count": total_leads,
        "current_page": page,
        "total_pages_count": total_pages
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
        
        # Use frontend provided subject/body if they exist, else fallback to session defaults
        body = data.body if data.body else (email_draft.get("body", "") if isinstance(email_draft, dict) else str(email_draft))
        subject = data.subject if data.subject else (email_draft.get("subject", "Quick hello") if isinstance(email_draft, dict) else "Quick hello")

        if not body:
            return {"sent": False, "error": "Email body is empty"}

        result = send_gmail(draft=body, to_email=to_email, subject=subject)
        print("✅ Sent!")
        return result

    except Exception as e:
        print("\n🚨 Send failed!")
        traceback.print_exc()
        return {"sent": False, "error": repr(e)}