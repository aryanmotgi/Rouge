#!/usr/bin/env python3
"""
Stage control — one command to get the demo into a known state.

    ../.venv/bin/python scripts/stage.py status
    ../.venv/bin/python scripts/stage.py prep uncontained     # attack succeeds
    ../.venv/bin/python scripts/stage.py prep protected       # trap freezes it
    ../.venv/bin/python scripts/stage.py prep clean           # control, no injection
    ../.venv/bin/python scripts/stage.py backend mock          # flip trap to mock
    ../.venv/bin/python scripts/stage.py backend tenki         # flip trap to real VM
    ../.venv/bin/python scripts/stage.py decoy                 # re-resolve decoy only

Decoy policy: PREFER Shreyash's real Wasmer decoy (DECOY_PRIMARY_URL). Only fall
back to Aryan's LOCAL STUB if the real one is unreachable. The active decoy is
printed LOUD every time so you never demo the stub by accident.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
ENV = dotenv_values(ROOT / ".env")
BASE = ENV.get("ROUGE_PIPELINE_URL", "http://127.0.0.1:8787")
PRIMARY = (ENV.get("DECOY_PRIMARY_URL") or "").strip()
STUB = (ENV.get("DECOY_STUB_URL") or "http://127.0.0.1:8791/accounts").strip()
RESOURCES = ROOT / "resources" / "onboarding_notes.md"

C = {"r": "\033[91m", "g": "\033[92m", "y": "\033[93m", "b": "\033[1m", "x": "\033[0m"}


def _health_url(url: str) -> str:
    """Same origin, /health path. The decoy's /accounts is a ROGUE-HIT endpoint
    that emits decoy_triggered — probing it would false-fire the tripwire on our
    own operator tooling. /health is the non-emitting reachability probe."""
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}/health"


def _reachable(url: str) -> bool:
    if not url:
        return False
    try:
        # probe /health, NOT the given (emitting) path — no false tripwire
        httpx.get(_health_url(url), timeout=2.0)
        return True
    except Exception:
        return False


def _post(path: str, body: dict | None = None) -> dict:
    try:
        return httpx.post(f"{BASE}{path}", json=body or {}, timeout=135.0).json()
    except Exception as e:
        return {"error": str(e)}


def _get(path: str) -> dict:
    try:
        return httpx.get(f"{BASE}{path}", timeout=5.0).json()
    except Exception as e:
        return {"error": str(e)}


def resolve_decoy() -> tuple[str, str]:
    """Return (url, label). Prefer real Wasmer decoy; else local stub."""
    if _reachable(PRIMARY):
        return PRIMARY, f"{C['g']}REAL Wasmer decoy (Shreyash){C['x']}"
    if _reachable(STUB):
        return STUB, f"{C['y']}LOCAL FALLBACK STUB (Shreyash's decoy unreachable){C['x']}"
    return STUB, f"{C['r']}LOCAL STUB — NOT RUNNING! start decoy_stub or Shreyash's decoy{C['x']}"


def write_decoy_url(url: str) -> None:
    """Point the planted bait's billing-portal URL at the chosen decoy."""
    txt = RESOURCES.read_text()
    txt = re.sub(r"(?m)^(\s*URL:\s*).*$", rf"\g<1>{url}", txt, count=1)
    RESOURCES.write_text(txt)


def cmd_status() -> None:
    h = _get("/health")
    t = _get("/trap/state")
    url, label = resolve_decoy()
    print(f"\n{C['b']}── Rouge stage status ──{C['x']}")
    print(f"pipeline : {BASE}  {'up' if h.get('ok') else C['r']+'DOWN'+C['x']}  events={h.get('events','?')}")
    print(f"trap     : backend={C['b']}{t.get('backend','?')}{C['x']}  "
          f"protect={t.get('protect','?')}  frozen={t.get('frozen','?')}  breached={t.get('breached','?')}")
    print(f"decoy    : {label}\n           -> {url}")
    print()


def cmd_backend(which: str) -> None:
    print(_post("/trap/backend", {"backend": which}))
    cmd_status()


def cmd_decoy() -> None:
    url, label = resolve_decoy()
    write_decoy_url(url)
    print(f"active decoy: {label}\n  bait now points to: {url}")


def cmd_prep(scenario: str) -> None:
    _post("/reset")
    _post("/trap/reset")
    if scenario == "uncontained":
        _post("/trap/mode", {"protect": False})
    elif scenario == "protected":
        _post("/trap/mode", {"protect": True})
    elif scenario == "clean":
        _post("/trap/mode", {"protect": False})
    else:
        print(f"unknown scenario '{scenario}' (uncontained|protected|clean)")
        return
    url, label = resolve_decoy()
    write_decoy_url(url)
    t = _get("/trap/state")
    banner = f"""
{C['b']}╔══════════════════════════════════════════════════════════╗
║  STAGE READY — {scenario.upper():<42}║
╠══════════════════════════════════════════════════════════╣{C['x']}
  protect : {t.get('protect')}      trap backend : {C['b']}{t.get('backend')}{C['x']}
  decoy   : {label}
            {url}
  agent   : run with {'ROUGE_INJECTION=off' if scenario=='clean' else 'ROUGE_INJECTION=on'}
{C['b']}╚══════════════════════════════════════════════════════════╝{C['x']}"""
    print(banner)
    if scenario == "clean":
        print("  (clean control: agent should touch NOTHING flagged)")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        cmd_status(); return
    cmd, *rest = args
    if cmd == "status":
        cmd_status()
    elif cmd == "prep" and rest:
        cmd_prep(rest[0])
    elif cmd == "backend" and rest:
        cmd_backend(rest[0])
    elif cmd == "decoy":
        cmd_decoy()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
