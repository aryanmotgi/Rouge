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

import asyncio
import collections
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

MAX_EVENTS = 5000
DASHBOARD = Path(__file__).resolve().parent.parent / "dashboard" / "index.html"

app = FastAPI(title="Rouge Event Pipeline")

# mount Aryan's Tenki trap + freeze routes on the same server
import sys as _sys  # noqa: E402
_sys.path.insert(0, str(Path(__file__).resolve().parent))
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


class _Hub:
    """Holds history + the set of connected websocket clients."""
    def __init__(self) -> None:
        self.history: collections.deque[dict] = collections.deque(maxlen=MAX_EVENTS)
        self.clients: set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def publish(self, event: dict) -> None:
        self.history.append(event)
        dead: list[WebSocket] = []
        for ws in list(self.clients):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    async def reset(self) -> None:
        self.history.clear()


hub = _Hub()


@app.post("/events")
async def post_event(event: Event) -> dict:
    payload = event.model_dump()
    if not payload["time"]:
        payload["time"] = datetime.now(timezone.utc).isoformat()
    async with hub.lock:
        await hub.publish(payload)
    return {"ok": True, "stored": len(hub.history)}


@app.get("/events")
async def get_events() -> JSONResponse:
    return JSONResponse(list(hub.history))


@app.post("/reset")
async def reset() -> dict:
    async with hub.lock:
        await hub.reset()
        # tell live clients to wipe their view
        await hub.publish({"actor": "system", "action": "reset",
                           "target": "", "detail": "run cleared", "flagged": False,
                           "time": datetime.now(timezone.utc).isoformat(), "extra": {}})
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
