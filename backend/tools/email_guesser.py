def guess_email(first_name: str, last_name: str, domain: str):

    if not domain:
        return None

    first = first_name.lower()
    last = last_name.lower()

    patterns = [
        f"{first}@{domain}",
        f"{first}.{last}@{domain}",
        f"{first}{last}@{domain}",
        f"{first[0]}{last}@{domain}",
        f"{first}{last[0]}@{domain}"
    ]

    return patterns