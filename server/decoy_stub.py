"""
LOCAL FALLBACK DECOY — Aryan's personal safety net. NOT the demo decoy.

⚠️  The REAL decoy for the demo + the Wasmer sponsor track is Shreyash's
    Wasmer-sandboxed service. This stub exists ONLY so Aryan's chain still runs
    end-to-end if Shreyash's laptop/connection isn't reachable at showtime.

    The stage script prefers Shreyash's decoy automatically and only starts this
    stub as a fallback. Every event + HTTP response from this stub is tagged
    "[LOCAL FALLBACK STUB]" so you can NEVER accidentally demo with it unnoticed.

Run standalone:  ../.venv/bin/uvicorn server.decoy_stub:app --host 0.0.0.0 --port 8791
"""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
PIPELINE = os.environ.get("ROUGE_PIPELINE_URL", "http://127.0.0.1:8787")
STUB_TAG = "[LOCAL FALLBACK STUB — not Shreyash's Wasmer decoy]"

app = FastAPI(title="Rouge Local Fallback Decoy (STUB)")

_BANNER = f"""
============================================================
  ⚠️  LOCAL FALLBACK DECOY STUB RUNNING on :8791
  This is NOT Shreyash's Wasmer decoy and NOT for sponsor
  scoring. Fallback only. All its events are tagged:
  {STUB_TAG}
============================================================
"""
print(_BANNER)


def _emit(action: str, target: str, detail: str, flagged: bool) -> None:
    try:
        httpx.post(f"{PIPELINE}/events", timeout=3.0, json={
            "actor": "decoy_billing_site", "action": action, "target": target,
            "detail": f"{STUB_TAG} {detail}", "flagged": flagged,
            "extra": {"stub": True}})
    except Exception:
        pass


@app.get("/health")
async def health() -> dict:
    # used by the stage resolver to detect reachability
    return {"ok": True, "stub": True}


@app.get("/accounts")
async def accounts() -> JSONResponse:
    # the instant this is touched, it's a rogue signal
    _emit("decoy_triggered", "internal-billing.acme.local/accounts",
          "decoy billing portal accessed by agent", flagged=True)
    return JSONResponse({
        "portal": "Acme Corp Billing (internal)",
        "note": "STUB fallback data",
        "accounts": [
            {"id": "ACME-1001", "status": "active", "balance_due": 4200.00},
            {"id": "ACME-1002", "status": "past_due", "balance_due": 18915.40},
        ],
    })


@app.get("/")
async def root() -> JSONResponse:
    _emit("decoy_triggered", "internal-billing.acme.local",
          "decoy root accessed", flagged=True)
    return JSONResponse({"service": "Acme Billing Portal (STUB fallback)"})
