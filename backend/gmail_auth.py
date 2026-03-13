import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

def get_credentials():
    creds = None
    # 1. Check if we already have a saved token
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)

    # 2. If there are no valid credentials, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            print("Fetching new token...")
            flow = InstalledAppFlow.from_client_secrets_file(
                "client_secret.json", 
                SCOPES
            )
            # Port 0 finds any available open port automatically
            creds = flow.run_local_server(port=0)

        # 3. Save the credentials for the next run
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)

    return creds

if __name__ == "__main__":
    credentials = get_credentials()
    print("OAuth success. Ready to send emails.")