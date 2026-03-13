import base64
import pickle
import os
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def send_test_email():
    # 1. Load credentials safely
    if not os.path.exists("token.pickle"):
        print("Error: token.pickle not found. Run your auth script first!")
        return

    with open("token.pickle", "rb") as token:
        creds = pickle.load(token)

    try:
        # 2. Build the service
        service = build("gmail", "v1", credentials=creds)

        # 3. Create the message
        message = MIMEText("Hello! This is a test email from your AI Outreach Tool.")
        message["to"] = "337.parth.gurav@gmail.com"
        message["from"] = "me"  # Gmail API uses 'me' as an alias for the authenticated user
        message["subject"] = "Test Email from Outreach Agent"

        # 4. Encode the message correctly
        # The Gmail API requires a URL-safe base64 encoded string
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        
        # 5. Send the email
        send_request = service.users().messages().send(
            userId="me", 
            body={"raw": raw_message}
        )
        result = send_request.execute()

        print(f'Email sent successfully! Message ID: {result["id"]}')

    except HttpError as error:
        print(f"An error occurred: {error}")
    except Exception as e:
        print(f"A generic error occurred: {e}")

if __name__ == "__main__":
    send_test_email()