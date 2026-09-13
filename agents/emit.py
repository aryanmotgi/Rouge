"""
Tiny event client. EVERY component imports this to report what it's doing.

Usage:
    from emit import emit
    emit("email_agent", "read_email", target="email_7",
         detail="Reading inbox item 7", flagged=False)

Fire-and-forget: if the pipeline is down we swallow the error so a demo
component never crashes just because the dashboard isn't up yet.
"""
from __future__ import annotations

import os
import httpx

PIPELINE = os.environ.get("ROUGE_PIPELINE_URL", "http://127.0.0.1:8000")


def emit(actor: str, action: str, target: str = "", detail: str = "",
         flagged: bool = False, **extra) -> None:
    body = {
        "actor": actor,
        "action": action,
        "target": target,
        "detail": detail,
        "flagged": flagged,
        "extra": extra,
    }
    try:
        httpx.post(f"{PIPELINE}/events", json=body, timeout=3.0)
    except Exception as e:  # noqa: BLE001 — never let telemetry kill the demo
        print(f"[emit] pipeline unreachable ({e}); event dropped: {actor}/{action}")
