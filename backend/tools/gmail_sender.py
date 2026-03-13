import os
import base64
import pickle
from datetime import datetime
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

def send_gmail(draft: str, to_email: str):
    print("   🚀 [GMAIL SENDER] Initializing...")
    
    # 1. Smarter Path Resolution
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    token_path = os.path.join(backend_dir, "token.pickle")
    
    if not os.path.exists(token_path):
        token_path = "token.pickle" # Fallback
        
    print(f"   📂 [GMAIL SENDER] Looking for token at: {token_path}")

    if not os.path.exists(token_path):
        raise FileNotFoundError(f"Missing token.pickle at {token_path}")

    with open(token_path, "rb") as token:
        creds = pickle.load(token)

    # 2. CRITICAL: Token Refresh Logic
    if not creds or not creds.valid:
        print("   🔄 [GMAIL SENDER] Token invalid or expired. Attempting refresh...")
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save the refreshed token so it works next time
            with open(token_path, "wb") as token:
                pickle.dump(creds, token)
            print("   ✅ [GMAIL SENDER] Token refreshed successfully.")
        else:
            raise Exception("Token expired and no refresh token available. You need to re-authenticate.")

    print("   🔌 [GMAIL SENDER] Building Gmail service...")
    service = build("gmail", "v1", credentials=creds)

    # Safely handle the draft text
    if not isinstance(draft, str):
        draft = str(draft)

    print("   ✉️ [GMAIL SENDER] Constructing message...")
    message = MIMEText(draft)
    message["to"] = to_email
    message["subject"] = "Outreach Email"

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    print("   📡 [GMAIL SENDER] Sending to Google API...")
    result = service.users().messages().send(
        userId="me",
        body={"raw": raw}
    ).execute()

    print(f"   ✅ [GMAIL SENDER] Message Sent! ID: {result['id']}")
    return {
        "sent": True,
        "message_id": result["id"],
        "timestamp": datetime.utcnow().isoformat()
    }