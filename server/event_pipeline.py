"""
Component 5 — The Shared Event Pipeline.

Every other component depends on this. It is intentionally tiny:
  POST /events    -> ingest one event, stamp it, store it, broadcast to live clients
  GET  /events    -> full history (JSON) — used by dashboard on first load
  WS   /stream    -> live feed: replays history, then streams new events
  GET  /          -> serves the live dashboard (Component 6)
  POST /reset     -> clears history (between demo runs)

Storage is in-memory (a ring buffer). This is a hackathon demo, not a
database — restart = clean slate, which is exactly what we want between runs.
"""
from __future__ import annotations

import sys as _sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

_sys.path.insert(0, str(Path(__file__).resolve().parent))
from bus import hub, publish  # noqa: E402

DASHBOARD = Path(__file__).resolve().parent.parent / "dashboard" / "index.html"

app = FastAPI(title="Rouge Event Pipeline")

# open CORS — hackathon build day: teammates' agent/decoy/dashboard hit this
# from other laptops + browsers. Wide-open is fine for a demo, never prod.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
    allow_headers=["*"], allow_credentials=False,
)

# mount Aryan's Tenki trap + freeze routes on the same server
from trap import router as trap_router  # noqa: E402
app.include_router(trap_router)


class Event(BaseModel):
    """Canonical event shape shared by ALL components."""
    time: str | None = None          # ISO8601 — server stamps if missing
    actor: str                        # "email_agent", "decoy_billing_site", "tenki_db", "agent_3"
    action: str                       # "read_email", "visited_url", "attempted_login", ...
    target: str = ""                  # "email_7", "internal-billing.company.local"
    detail: str = ""                  # free text: reasoning, query run, etc.
    flagged: bool = False             # true for suspicious / rogue actions
    extra: dict[str, Any] = Field(default_factory=dict)  # escape hatch (positions, ids)


@app.post("/events")
async def post_event(event: Event) -> dict:
    # external components (agents, decoy) POST here; in-process code calls publish()
    await publish(event.model_dump())
    return {"ok": True, "stored": len(hub.history)}


@app.get("/events")
async def get_events() -> JSONResponse:
    return JSONResponse(list(hub.history))


@app.post("/reset")
async def reset() -> dict:
    hub.history.clear()
    await publish({"actor": "system", "action": "reset", "detail": "run cleared"})
    return {"ok": True}


@app.websocket("/stream")
async def stream(ws: WebSocket) -> None:
    await ws.accept()
    # replay history so a late-joining dashboard sees the whole run
    for ev in list(hub.history):
        await ws.send_json(ev)
    hub.clients.add(ws)
    try:
        while True:
            await ws.receive_text()  # we don't expect client msgs; keeps conn open
    except WebSocketDisconnect:
        pass
    finally:
        hub.clients.discard(ws)


@app.get("/")
async def dashboard() -> FileResponse:
    return FileResponse(DASHBOARD)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "events": len(hub.history), "clients": len(hub.clients)}
