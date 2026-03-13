"""
session_store.py — in-process session memory for the outreach agent.
Keyed by session_id (UUID string sent from the frontend).
"""

from threading import Lock

_store: dict[str, dict] = {}
_lock = Lock()


def get_session(session_id: str) -> dict:
    """Return the memory dict for a session, creating it if missing."""
    with _lock:
        if session_id not in _store:
            _store[session_id] = {
                "campaigns_run": 0,
                "goals": [],                # list of goal strings run this session
                "prospects_targeted": [],   # list of prospect names already seen
                "outreach_targets": [],     # <--- FIX: Actually store the full prospect data here!
            }
        return _store[session_id]


def update_session(session_id: str, goal: str, new_prospects: list[dict]) -> None:
    """
    Called after a campaign completes.
    Appends the goal and all newly targeted prospect names to session memory.
    """
    with _lock:
        session = _store.setdefault(session_id, {
            "campaigns_run": 0,
            "goals": [],
            "prospects_targeted": [],
            "outreach_targets": [], 
        })
        
        session["campaigns_run"] += 1
        session["goals"].append(goal)
        
        # FIX: Save the full data blocks so /send-email can use them
        session["outreach_targets"] = new_prospects 
        
        # Keep the original logic for the AI memory context
        for p in new_prospects:
            name = p.get("prospect", {}).get("name") or p.get("name")
            if name and name not in session["prospects_targeted"]:
                session["prospects_targeted"].append(name)


def build_memory_context(session_id: str) -> str:
    """
    Returns a plain-text memory block to inject into the Nova Pro planner prompt.
    Returns empty string on first run.
    """
    session = get_session(session_id)

    if session["campaigns_run"] == 0:
        return ""

    goals_block = "\n".join(
        f"  - {g}" for g in session["goals"][-5:]  # last 5 goals max
    )
    prospects_block = ", ".join(session["prospects_targeted"][-20:])  # last 20

    return f"""
=== SESSION MEMORY (DO NOT RE-TARGET THESE) ===
Campaigns run this session: {session["campaigns_run"]}

Previous goals:
{goals_block}

Prospects already targeted (skip these):
{prospects_block}
=================================================
"""