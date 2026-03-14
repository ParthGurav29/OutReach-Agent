"""
email_finder.py
Pipeline:
1. Resolve domain
2. Generate 9 patterns
3. Gravatar check (instant, no auth)
4. SMTP verify remaining (with hard thread timeout — no hanging)
5. Fallback to first.last@domain
"""

import hashlib
import asyncio
import smtplib
import dns.resolver
import httpx
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from ddgs import DDGS


# ─── SKIP LISTS ───────────────────────────────────────────────────────────────

SKIP_COMPANIES = {
    "self-employed", "freelance", "independent",
    "youtube", "instagram", "twitter", "facebook",
    "unknown", "unknown it firm", "unknown firm",
    "unknown college", "n/a", "none", "not specified",
}

INVALID_DOMAINS = {
    "linkedin.com", "in.linkedin.com", "twitter.com", "x.com",
    "instagram.com", "facebook.com", "youtube.com", "github.com",
    "wikipedia.org", "glassdoor.com", "naukri.com", "indeed.com",
    "crunchbase.com", "nasa.gov", "collegeboard.org",
    "scholarshare529.com", "unknowngroup.com",
}

# Domains that block SMTP — skip straight to fallback
SMTP_BLOCKED = {
    "tcs.com", "infosys.com", "wipro.com",
    "gmail.com", "outlook.com", "yahoo.com",
    "hotmail.com", "live.com", "icloud.com",
}

# Shared thread pool for SMTP — limits concurrent connections
_executor = ThreadPoolExecutor(max_workers=10)


# ─── DOMAIN RESOLVER ──────────────────────────────────────────────────────────

def resolve_domain(company: str) -> str | None:
    if not company or company.lower().strip() in SKIP_COMPANIES:
        return None
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(f"{company} official website", max_results=8))
        for r in results:
            url = r.get("href", "")
            url = url.replace("https://", "").replace("http://", "").replace("www.", "")
            domain = url.split("/")[0].strip().lower()
            if "." not in domain or len(domain) < 4:
                continue
            if any(s in domain for s in ["linkedin", "twitter", "facebook", "wikipedia",
                                          "glassdoor", "naukri", "nasa", "unknowngroup",
                                          "scholarshare", "collegeboard", "instagram"]):
                continue
            if domain in INVALID_DOMAINS:
                continue
            return domain
    except Exception:
        pass
    return None


# ─── PATTERN GENERATOR ────────────────────────────────────────────────────────

def guess_emails(first: str, last: str, domain: str) -> list[str]:
    f, l, d = first.lower().strip(), last.lower().strip(), domain.lower().strip()
    fi = f[0]
    return [
        f"{f}.{l}@{d}",
        f"{f}@{d}",
        f"{fi}{l}@{d}",
        f"{f}{l}@{d}",
        f"{fi}.{l}@{d}",
        f"{f}_{l}@{d}",
        f"{l}.{f}@{d}",
        f"{l}{fi}@{d}",
        f"{l}@{d}",
    ]


# ─── GRAVATAR CHECK ───────────────────────────────────────────────────────────

async def gravatar_check(email: str, client: httpx.AsyncClient) -> bool:
    h = hashlib.md5(email.lower().strip().encode()).hexdigest()
    try:
        resp = await client.get(
            f"https://www.gravatar.com/avatar/{h}?d=404",
            timeout=4
        )
        return resp.status_code == 200
    except Exception:
        return False


# ─── SMTP VERIFICATION (hard thread timeout) ──────────────────────────────────

def _get_mx(domain: str) -> str | None:
    try:
        records = dns.resolver.resolve(domain, "MX", lifetime=3)
        return str(sorted(records, key=lambda r: r.preference)[0].exchange).rstrip(".")
    except Exception:
        return None


def _smtp_probe(email: str, mx: str) -> bool:
    try:
        with smtplib.SMTP(timeout=3) as s:
            s.connect(mx, 25)
            s.helo("probe.example.com")
            s.mail("probe@example.com")
            code, _ = s.rcpt(email)
            s.quit()
            return code == 250
    except Exception:
        return False


def _verify_sync(email: str) -> dict:
    """Runs entirely in a thread — safe to hard-kill via Future timeout."""
    domain = email.split("@")[-1].lower()

    mx = _get_mx(domain)
    if not mx:
        return {"email": email, "valid": False, "reason": "no_mx"}

    valid = _smtp_probe(email, mx)
    return {"email": email, "valid": valid, "reason": "smtp"}


async def smtp_verify(email: str, timeout: int = 6) -> dict:
    """
    Runs SMTP probe in a thread with a TRUE hard timeout.
    Uses Future.result(timeout) — kills the thread result wait after N seconds.
    The thread may still run briefly in background but will not block the event loop.
    """
    domain = email.split("@")[-1].lower()

    if domain in SMTP_BLOCKED:
        return {"email": email, "valid": False, "reason": "blocked"}

    loop = asyncio.get_running_loop()
    future = loop.run_in_executor(_executor, _verify_sync, email)

    try:
        result = await asyncio.wait_for(future, timeout=timeout)
        return result
    except (asyncio.TimeoutError, FuturesTimeout):
        return {"email": email, "valid": False, "reason": "timeout"}
    except Exception as e:
        return {"email": email, "valid": False, "reason": str(e)}


def _is_catchall(results: list[dict]) -> bool:
    return all(r["valid"] for r in results) and len(results) > 0


# ─── MAIN FINDER ─────────────────────────────────────────────────────────────

async def find_email(first: str, last: str, company: str, domain: str | None = None) -> dict:
    name = f"{first} {last}"

    # Step 1 — Resolve domain
    if not domain:
        domain = resolve_domain(company)
        if not domain:
            return {"name": name, "company": company, "email": None,
                    "confidence": "unresolved", "reason": "domain not found"}

    # Step 2 — Generate patterns
    patterns = guess_emails(first, last, domain)

    # Step 3 — Gravatar check all patterns concurrently (fast)
    async with httpx.AsyncClient() as client:
        grav_results = await asyncio.gather(*[gravatar_check(e, client) for e in patterns])

    for email, found in zip(patterns, grav_results):
        if found:
            print(f"   🎯 Gravatar verified: {email}")
            return {"name": name, "company": company, "email": email,
                    "confidence": "high", "reason": "gravatar"}

    # Step 4 — SMTP verify all patterns concurrently (with hard timeout)
    if domain not in SMTP_BLOCKED:
        smtp_results = await asyncio.gather(*[smtp_verify(e) for e in patterns])

        # Catch-all detection
        if _is_catchall(smtp_results):
            best = f"{first.lower()}.{last.lower()}@{domain}"
            print(f"   ⚠️  Catch-all → {best}")
            return {"name": name, "company": company, "email": best,
                    "confidence": "low", "reason": "catch-all"}

        # First confirmed hit
        for r in smtp_results:
            if r["valid"]:
                print(f"   ✅ SMTP verified: {r['email']}")
                return {"name": name, "company": company, "email": r["email"],
                        "confidence": "high", "reason": "smtp"}

    # Step 5 — Pattern fallback
    fallback = f"{first.lower()}.{last.lower()}@{domain}"
    print(f"   📧 Pattern fallback: {fallback}")
    return {"name": name, "company": company, "email": fallback,
            "confidence": "low", "reason": "pattern_fallback"}


# ─── TEST ─────────────────────────────────────────────────────────────────────

TEST_PROSPECTS = [
    {"first": "Bhagyashree", "last": "Patil",     "company": "Reckitt",                  "domain": None},
    {"first": "Christina",   "last": "Joseph",    "company": "Tata Consultancy Services", "domain": "tcs.com"},
    {"first": "Samruddhi",   "last": "Parbat",    "company": "Matrix Bricks Infotech",    "domain": None},
    {"first": "Neha",        "last": "Maurya",    "company": "Vertoz",                    "domain": "vertoz.com"},
    {"first": "Gunjan",      "last": "Malviya",   "company": "Experian India",            "domain": "experian.com"},
    {"first": "Ruchi",       "last": "Arya",      "company": "JioStar",                   "domain": "jiostar.com"},
    {"first": "Shreyas",     "last": "Haridas",   "company": "Spotify",                   "domain": "spotify.com"},
    {"first": "Chetana",     "last": "Patnaik",   "company": "LTIMindtree",               "domain": "ltimindtree.com"},
    {"first": "Zishan",      "last": "Shaikh",    "company": "VFS Global",                "domain": "vfsglobal.com"},
    {"first": "Mili",        "last": "Panicker",  "company": "WebEngage",                 "domain": "webengage.com"},
    {"first": "Hetal",       "last": "Jain",      "company": "Gupshup",                   "domain": "gupshup.io"},
    {"first": "Sachin",      "last": "Desai",     "company": "Dentsu",                    "domain": "dentsu.com"},
    {"first": "Janki",       "last": "Tambe",     "company": "Mondelez International",    "domain": "mondelez.com"},
]


async def main():
    print("🚀 Email Finder — Gravatar + SMTP\n")

    results = []
    for p in TEST_PROSPECTS:
        print(f"\n🔍 {p['first']} {p['last']} | {p['company']}")
        r = await find_email(p["first"], p["last"], p["company"], p.get("domain"))
        results.append(r)

    print(f"\n{'='*60}")
    print("📋 FINAL RESULTS")
    print(f"{'='*60}")

    high = [r for r in results if r["confidence"] == "high"]
    low  = [r for r in results if r["confidence"] == "low"]
    fail = [r for r in results if not r.get("email")]

    for r in results:
        icon  = "🎯" if r["confidence"] == "high" else "📧"
        email = r.get("email") or "NOT FOUND"
        print(f"  {icon} {r['name']:25} → {email:45} [{r['reason']}]")

    print(f"\n  🎯 Verified (high): {len(high)}/{len(results)}")
    print(f"  📧 Pattern guess:   {len(low)}/{len(results)}")
    print(f"  ❌ Not found:       {len(fail)}/{len(results)}")


if __name__ == "__main__":
    asyncio.run(main())