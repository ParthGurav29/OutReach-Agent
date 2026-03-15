"""
linkedin_sender.py — Playwright LinkedIn DM Automation
-------------------------------------------------------
Sends LinkedIn DMs via headless Chromium using saved session cookies.

Usage:
  - First time:  python -m backend.tools.linkedin_sender --login
                  (opens headed browser → log in manually → cookies saved)
  - After that:   send_linkedin_dm(prospect_url, message) works headlessly.
"""

import os
import sys
import json
import random
import asyncio
from pathlib import Path

STATE_FILE = Path(__file__).resolve().parent.parent / "state.json"


# ─────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────

def ensure_linkedin_session() -> dict:
    """Check if state.json exists and return auth status."""
    exists = STATE_FILE.exists() and STATE_FILE.stat().st_size > 10
    return {
        "authenticated": exists,
        "state_file": str(STATE_FILE),
    }


async def linkedin_login_interactive():
    """
    Opens a HEADED Chromium browser so the user can log into LinkedIn manually.
    Once logged in, saves cookies/storage to state.json.
    """
    from playwright.async_api import async_playwright

    print("\n🔐 LinkedIn Login — Interactive Mode")
    print("A browser window will open. Please log in to LinkedIn.")
    print("Once you see your LinkedIn feed, close the browser window.\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")

        print("⏳ Waiting for you to log in...")
        # Wait until URL changes away from /login (feed, mynetwork, etc.)
        try:
            await page.wait_for_url("**/feed/**", timeout=120_000)
        except Exception:
            # Fallback — user may land on a different page
            await asyncio.sleep(5)

        # Save session state (cookies + localStorage)
        await context.storage_state(path=str(STATE_FILE))
        print(f"✅ Session saved to {STATE_FILE}")

        await browser.close()


# ─────────────────────────────────────────────────────────────────
# Core DM sender
# ─────────────────────────────────────────────────────────────────

async def send_linkedin_dm(
    prospect_url: str,
    message: str,
    log_callback=None,
) -> dict:
    """
    Sends a LinkedIn DM to the prospect via Playwright (headless).

    Args:
        prospect_url: Full LinkedIn profile URL (e.g. https://linkedin.com/in/johndoe)
        message: The DM body text to send
        log_callback: Optional async callable(str) for streaming live logs

    Returns:
        {"sent": True/False, "error": str | None}
    """
    from playwright.async_api import async_playwright

    async def log(msg: str):
        print(msg)
        if log_callback:
            try:
                await log_callback(msg)
            except Exception:
                pass

    # ── Validate inputs ───────────────────────────────────────────
    if not prospect_url or "linkedin.com" not in prospect_url:
        return {"sent": False, "error": f"Invalid LinkedIn URL: {prospect_url}"}

    if not message or not message.strip():
        return {"sent": False, "error": "DM message body is empty"}

    # ── Check auth ────────────────────────────────────────────────
    auth = ensure_linkedin_session()
    if not auth["authenticated"]:
        return {
            "sent": False,
            "error": "Not logged in. Run: python -m backend.tools.linkedin_sender --login",
        }

    await log("🤖 Opening LinkedIn browser...")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                storage_state=str(STATE_FILE),
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
            page = await context.new_page()

            # ── Navigate to profile ───────────────────────────────
            await log(f"🔗 Navigating to profile: {prospect_url}")
            await page.goto(prospect_url, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(random.uniform(2.0, 3.5))

            # ── Check if we're still logged in ────────────────────
            if "/login" in page.url:
                await browser.close()
                # Delete stale state file
                STATE_FILE.unlink(missing_ok=True)
                return {
                    "sent": False,
                    "error": "LinkedIn session expired. Run: python -m backend.tools.linkedin_sender --login",
                }

            # ── Click the "Message" button ────────────────────────
            await log("💬 Looking for Message button...")

            # LinkedIn has multiple possible selectors for the Message button
            message_btn = None
            selectors = [
                'button.artdeco-button:has-text("Message")',
                'button:has-text("Message")',
                'a:has-text("Message")',
                '[data-control-name="message"]',
                '.pvs-profile-actions button:has-text("Message")',
                '.pvs-profile-actions a:has-text("Message")',
                'div[role="button"]:has-text("Message")',
                'span:text-is("Message")',
                'button[aria-label^="Message"]',
            ]
            for sel in selectors:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible(timeout=3000):
                        message_btn = btn
                        break
                except Exception:
                    continue

            if not message_btn:
                # Try scrolling down slightly and retry
                await page.mouse.wheel(0, 300)
                await asyncio.sleep(1.5)
                for sel in selectors:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible(timeout=2000):
                            message_btn = btn
                            break
                    except Exception:
                        continue

            if not message_btn:
                # Try to check if "Message" is inside the "More" dropdown
                try:
                    more_btn = page.locator('button[aria-label="More actions"], button:has-text("More")').first
                    if await more_btn.is_visible(timeout=2000):
                        await more_btn.click()
                        await asyncio.sleep(1)
                        for sel in selectors:
                            btn = page.locator(sel).first
                            if await btn.is_visible(timeout=1000):
                                message_btn = btn
                                break
                except Exception:
                    pass

            # Fallback to "Connect" -> "Add a note" if Message button is still not found
            if not message_btn:
                await log("🤝 'Message' button not found. Attempting 'Connect' with note...")
                connect_btn = None
                connect_selectors = [
                    'button.artdeco-button:has-text("Connect")',
                    'button:has-text("Connect")',
                    'button[aria-label^="Invite"]',
                    'div[role="button"]:has-text("Connect")',
                    'span:text-is("Connect")',
                    'a:has-text("Connect")',
                ]
                for sel in connect_selectors:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible(timeout=2000):
                            connect_btn = btn
                            break
                    except Exception:
                        continue
                
                # Check for "Connect" inside "More" dropdown if not found on main profile
                if not connect_btn:
                    try:
                        more_btn = page.locator('button[aria-label="More actions"], button:has-text("More")').first
                        if await more_btn.is_visible(timeout=2000):
                            # Ensure it's open (click it again if closed, or just click if we didn't before)
                            # To be safe, just evaluate click
                            await more_btn.evaluate("node => node.click()")
                            await asyncio.sleep(1)
                            for sel in connect_selectors:
                                btn = page.locator(sel).first
                                if await btn.is_visible(timeout=1000):
                                    connect_btn = btn
                                    break
                    except Exception:
                        pass
                
                if connect_btn is not None:
                    try:
                        await connect_btn.click(force=True, timeout=3000)
                    except Exception:
                        await connect_btn.evaluate("node => node.click()")
                    
                    await asyncio.sleep(1.5)
                    
                    # Check for email requirement blocker
                    email_input = page.locator('input[type="email"], input#email').first
                    if await email_input.is_visible(timeout=2000):
                        await log("⚠️ Cannot send connection request: LinkedIn requires the prospect's email address.")
                        await browser.close()
                        return {"sent": False, "error": "LinkedIn requires the prospect's email address to connect."}
                    
                    # Check for "Add a note" button
                    add_note_btn = None
                    note_selectors = ['button:has-text("Add a note")', 'button[aria-label="Add a note"]']
                    for sel in note_selectors:
                        try:
                            btn = page.locator(sel).first
                            if await btn.is_visible(timeout=2000):
                                add_note_btn = btn
                                break
                        except Exception:
                            continue
                    
                    if add_note_btn is not None:
                        await add_note_btn.click()
                        await asyncio.sleep(1)
                        
                        note_box = page.locator('textarea[name="message"], textarea#custom-message').first
                        if await note_box.is_visible(timeout=2000):
                            await note_box.fill(message)
                            await asyncio.sleep(1)
                            
                            send_note_btn = page.locator('button[aria-label="Send invitation"], button:has-text("Send")').first
                            if await send_note_btn.is_visible(timeout=2000):
                                await send_note_btn.click()
                                await log("✅ Connection request with note sent successfully!")
                                await asyncio.sleep(2)
                                await context.storage_state(path=str(STATE_FILE))
                                await browser.close()
                                return {"sent": True, "error": None}
                            else:
                                await log("⚠️ Could not find 'Send' button for connection note.")
                        else:
                            await log("⚠️ Could not find textarea for connection note.")
                    else:
                        await log("⚠️ Could not find 'Add a note' button in Connect modal.")
                        
                await browser.close()
                return {
                    "sent": False,
                    "error": "Could not find 'Message' or 'Connect' button. They may not be a connection or require InMail.",
                }

            await message_btn.click()
            await log("✅ Message dialog opened")
            await asyncio.sleep(random.uniform(1.5, 2.5))

            # ── Type the message ──────────────────────────────────
            await log("✍️  Typing message...")

            # Check for Premium InMail Subject field
            subject_box = None
            subject_selectors = [
                'input[name="subject"]',
                'input[placeholder*="Subject"]',
                'input.msg-form__subject',
            ]
            for sel in subject_selectors:
                try:
                    box = page.locator(sel).first
                    if await box.is_visible(timeout=1000):
                        subject_box = box
                        break
                except Exception:
                    continue
            
            if subject_box:
                await log("📝 Found InMail Subject field, filling it...")
                try:
                    await subject_box.fill("Connecting on LinkedIn")
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

            # LinkedIn's message box selectors
            msg_box = None
            msg_selectors = [
                'div.msg-form__contenteditable[contenteditable="true"]',
                'div[role="textbox"][contenteditable="true"]',
                '.msg-form__msg-content-container div[contenteditable="true"]',
            ]
            for sel in msg_selectors:
                try:
                    box = page.locator(sel).first
                    if await box.is_visible(timeout=5000):
                        msg_box = box
                        break
                except Exception:
                    continue

            if msg_box is None:
                await browser.close()
                return {"sent": False, "error": "Could not find message input box"}

            # Dismiss any popup overlays and force click
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.5)
            try:
                await msg_box.click(force=True, timeout=3000)
            except Exception:
                await msg_box.evaluate("node => node.focus()")
            await asyncio.sleep(random.uniform(0.5, 1.0))

            # Insert text safely bypassing pointer events blocks
            await msg_box.evaluate("node => node.innerHTML = ''")
            await page.keyboard.insert_text(message)
            await asyncio.sleep(random.uniform(1.0, 2.0))

            # ── Click Send ────────────────────────────────────────
            await log("📩 Sending message...")

            send_btn = None
            send_selectors = [
                'button.msg-form__send-button',
                'button[type="submit"]:has-text("Send")',
                'button:has-text("Send")',
            ]
            for sel in send_selectors:
                try:
                    btn = page.locator(sel).first
                    if await btn.is_visible(timeout=3000):
                        send_btn = btn
                        break
                except Exception:
                    continue

            if send_btn is None:
                await browser.close()
                return {"sent": False, "error": "Could not find Send button"}

            try:
                await send_btn.click(force=True, timeout=3000)
            except Exception:
                await send_btn.evaluate("node => node.click()")
            await asyncio.sleep(random.uniform(1.5, 3.0))

            # ── Save updated cookies ──────────────────────────────
            await context.storage_state(path=str(STATE_FILE))

            await log("✅ Message sent successfully!")
            await browser.close()

            return {"sent": True, "error": None}

    except Exception as e:
        error_msg = f"Playwright error: {str(e)}"
        await log(f"⚠️ {error_msg}")
        return {"sent": False, "error": error_msg}


# ─────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--login" in sys.argv:
        asyncio.run(linkedin_login_interactive())
    elif "--status" in sys.argv:
        status = ensure_linkedin_session()
        print(json.dumps(status, indent=2))
    else:
        print("Usage:")
        print("  python -m backend.tools.linkedin_sender --login    # Log in to LinkedIn")
        print("  python -m backend.tools.linkedin_sender --status   # Check auth status")
