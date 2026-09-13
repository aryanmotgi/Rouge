"""
POST /run — kick off a REAL agent run from the dashboard command box.

The frontend's command box POSTs here; we reset the pipeline, set the trap mode
for the scenario, then spawn the real email agent + cascade as background
subprocesses. Their events stream out over the existing WS (/stream) — so the
dashboard shows the genuine run, not a scripted animation.

Fire-and-forget: /run returns immediately with 202; the run unfolds live on the
event feed. One run at a time.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
PY = str(ROOT / ".venv" / "bin" / "python")
AGENTS = str(ROOT / "agents")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bus import hub, publish  # noqa: E402
import trap  # noqa: E402  (shared trap state — set protect/backend in-process)

router = APIRouter()

# per-scenario config: (protect, injection-on)
SCENARIOS = {
    "uncontained": (False, "on"),
    "protected": (True, "on"),
    "clean": (False, "off"),
}

_state = {"running": False}


class Run(BaseModel):
    scenario: str = "uncontained"
    backend: str = "mock"          # mock (venue-safe) | tenki (real microVM)
    cascade_agents: int = 5
    # "rehearsal" = deterministic driver (reliable stage default; real trap/
    # decoy/freeze + real events, fixed beats). "llm" = live LLM email agent
    # (authentic real-agent injection, but nondeterministic — showcase only).
    driver: str = "rehearsal"


async def _spawn(cmd: list[str], env: dict) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=AGENTS, env=env,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
    await proc.wait()


async def _do_run(scenario: str, backend: str, n: int, driver: str) -> None:
    protect, injection = SCENARIOS[scenario]
    trap.state["protect"] = protect
    trap.state["backend"] = backend
    trap.state["scenario"] = scenario
    trap.state.update(frozen=False, sandbox_id=None, breached=False)
    env = {**os.environ, "ROUGE_INJECTION": injection}
    try:
        await publish({"actor": "system", "action": "run_started",
                       "detail": f"scenario={scenario} backend={backend} driver={driver}"})
        if driver == "llm":
            # live LLM agent — authentic but nondeterministic (showcase)
            await _spawn([PY, "email_agent.py"], env)
            await _spawn([PY, "cascade.py", str(n)], env)
        else:
            # deterministic driver — reliable stage default. Runner already reset
            # history + set trap mode/scenario, so tell it to skip its own reset.
            await _spawn([PY, "rehearsal.py", scenario],
                         {**env, "REHEARSAL_NO_RESET": "1"})
        await publish({"actor": "system", "action": "run_finished", "detail": scenario})
    finally:
        _state["running"] = False


@router.post("/run", status_code=202)
async def run(body: Run) -> dict:
    if body.scenario not in SCENARIOS:
        return {"ok": False, "error": f"scenario must be one of {list(SCENARIOS)}"}
    if _state["running"]:
        return {"ok": False, "error": "a run is already in progress"}
    _state["running"] = True
    # set scenario up front so clean-run decoy isolation is active immediately —
    # before any stray external decoy hit can land between reset and spawn.
    trap.state["scenario"] = body.scenario
    # clean slate for the new run
    hub.history.clear()
    await publish({"actor": "system", "action": "reset", "detail": "run cleared"})
    asyncio.create_task(_do_run(body.scenario, body.backend, body.cascade_agents, body.driver))
    return {"ok": True, "scenario": body.scenario, "driver": body.driver, "running": True}


@router.get("/run/state")
async def run_state() -> dict:
    return {"running": _state["running"]}
