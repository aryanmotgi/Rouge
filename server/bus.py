"""
Shared in-process event bus. Both the pipeline routes and the trap publish here
directly — NO HTTP self-calls (those deadlock the single event loop).

External components (agents on other laptops, the decoy) still POST /events over
HTTP; that hits `publish()` too. In-process code should call `publish()` directly.
"""
from __future__ import annotations

import asyncio
import collections
from datetime import datetime, timezone

MAX_EVENTS = 5000


class Hub:
    def __init__(self) -> None:
        self.history: collections.deque[dict] = collections.deque(maxlen=MAX_EVENTS)
        self.clients: set = set()
        self.lock = asyncio.Lock()

    async def _fanout(self, event: dict) -> None:
        self.history.append(event)
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)


hub = Hub()


async def publish(event: dict) -> None:
    """Stamp + store + broadcast one event. Safe to await from any async handler."""
    if not event.get("time"):
        event["time"] = datetime.now(timezone.utc).isoformat()
    event.setdefault("target", "")
    event.setdefault("detail", "")
    event.setdefault("flagged", False)
    event.setdefault("extra", {})
    async with hub.lock:
        await hub._fanout(event)
