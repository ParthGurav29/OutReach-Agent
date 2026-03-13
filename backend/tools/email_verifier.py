import smtplib


def verify_email(email: str):

    try:

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()

        # we are NOT sending email
        # only checking format

        if "@" not in email:
            return False

        return True

    except Exception:

        return False