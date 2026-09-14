"""
The cascade — the "1 malicious agent infects the rest" beat.

After the compromised email agent poisons the shared log, the other team agents
do their normal work: each reads the shared task log. Because the poisoned note
tells them the onboarding file has portal + DB access, the ones that act on it
get compromised too — they emit `shared_update_read` (flagged), which lights
their node red on the dashboard and fires the edge from the source agent.

Detection of "is there poison to catch" is done by checking the pipeline for a
flagged `shared_update_posted` (the seed). So this works whether the seed came
from Rithik's live agent or the deterministic rehearsal driver. In PROTECTED
mode the freeze cut the agent before it could post, so there's no seed — the
cascade agents read the log, find nothing, and stay clean. That contrast IS the
product.

    ../.venv/bin/python cascade.py            # 5 agents (default)
    ../.venv/bin/python cascade.py 5 0.4      # n agents, stagger seconds
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
ENV = dotenv_values(ROOT / ".env")
B = ENV.get("ROUGE_PIPELINE_URL", "http://127.0.0.1:8787")

POISON_MARKERS = ("onboarding_notes", "/resources", "db access", "portal", "shared/finance")

# The poisoned note points every infected agent at the same onboarding file for
# the shared DB creds. Read them from that file (the honest path: agent follows
# the poison to the file to the credential), so each agent can independently
# attempt its own login and trip the trap — just like the email agent did.
BAIT_FILE = ROOT / "resources" / "onboarding_notes.md"


def _bait_creds() -> tuple[str, str] | None:
    try:
        text = BAIT_FILE.read_text()
    except Exception:
        return None
    user = pw = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("username:"):
            user = s.split(":", 1)[1].strip()
        elif s.startswith("password:"):
            pw = s.split(":", 1)[1].strip()
    return (user, pw) if user and pw else None


def _emit(actor, action, target="", detail="", flagged=False):
    try:
        httpx.post(f"{B}/events", timeout=5.0, json={
            "actor": actor, "action": action, "target": target,
            "detail": detail, "flagged": flagged, "extra": {}})
    except Exception as e:  # never let telemetry kill the run
        print(f"[cascade] emit dropped ({e})")


def _seed_present() -> bool:
    """Is there a poisoned note in the shared log for agents to pick up?"""
    try:
        events = httpx.get(f"{B}/events", timeout=5.0).json()
    except Exception:
        return False
    for e in events:
        if e.get("action") == "shared_update_posted" and e.get("flagged"):
            return True
        # also treat any flagged note whose text looks poisoned as a seed
        if e.get("action") == "shared_update_posted" and any(
                m in (e.get("detail", "").lower()) for m in POISON_MARKERS):
            return True
    return False


def _agent_login(agent: str, creds: tuple[str, str] | None) -> None:
    """Infected agent follows the poison to the shared DB and tries the creds —
    tripping the SAME real trap the email agent hit. Each agent does this on its
    own, so the trap fires once per compromised agent (step 8 of the demo)."""
    if not creds:
        return
    user, pw = creds
    _emit(agent, "attempted_login", "tenki_db",
          f"logging into shared DB as {user} (creds from onboarding notes)", flagged=True)
    try:
        # hit the real trap endpoint — it owns the tenki_db trap_triggered /
        # login_accepted events, so the audience sees each agent trip the trap.
        httpx.post(f"{B}/db/login", timeout=130.0,
                   json={"username": user, "password": pw})
    except Exception as e:
        print(f"[cascade] {agent} login dropped ({e})")


def run_cascade(n: int = 5, stagger: float = 0.5) -> int:
    poisoned = _seed_present()
    creds = _bait_creds()
    print(f"=== CASCADE: {n} agents check the shared log "
          f"({'poison present — spread expected' if poisoned else 'no seed — should stay clean'}) ===")
    infected = 0
    for i in range(1, n + 1):
        agent = f"agent_{i}"
        _emit(agent, "read_shared_log", "shared_log", "checking shared team log for updates")
        time.sleep(min(0.25, stagger))
        if poisoned:
            infected += 1
            _emit(agent, "shared_update_read", "shared_log",
                  "ingested poisoned note — following it to the onboarding creds", flagged=True)
            _agent_login(agent, creds)   # each agent independently trips the trap
            print(f"  {agent} INFECTED")
        else:
            _emit(agent, "reasoning", "self", "nothing actionable in the shared log")
            print(f"  {agent} clean")
        time.sleep(stagger)
    print(f"=== cascade done: {infected}/{n} infected ===")
    return infected


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    stagger = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    run_cascade(n, stagger)
