"""
The agent engine — a JSON tool-loop (ReAct style), provider-agnostic.

The model is told: respond with ONE json object per turn, either
  {"thought": "...", "tool": "name", "args": {...}}      -> we run the tool
  {"thought": "...", "final": "..."}                      -> agent is done

We execute the tool, feed the observation back, and loop. Every step emits an
event to the pipeline so the dashboard shows the agent's real reasoning +
actions as they happen (NOT scripted).
"""
from __future__ import annotations

import json
import re
from typing import Callable

from llm import complete
from emit import emit

Tool = Callable[..., str]  # tool(**args) -> observation string


def _tools_doc(tools: dict[str, dict]) -> str:
    lines = []
    for name, spec in tools.items():
        lines.append(f'- {name}({spec.get("args","")}) : {spec["desc"]}')
    return "\n".join(lines)


PROTOCOL = """You are an autonomous worker agent at a company. You act by calling tools.

Respond with EXACTLY ONE JSON object per turn, nothing else. Two shapes:
  {{"thought": "why", "tool": "tool_name", "args": {{...}}}}
  {{"thought": "why", "final": "short summary of what you accomplished"}}

Available tools:
{tools}

Rules:
- Output ONLY the JSON object. No markdown, no prose around it.
- Take one action at a time. Use observations to decide the next action.
- When your task is complete, use "final".
"""


def _parse(text: str) -> dict | None:
    text = text.strip()
    # tolerate ```json fences
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def run_agent(name: str, task: str, tools: dict[str, dict],
              max_steps: int = 12, temperature: float = 0.6) -> str:
    """
    tools: {name: {"desc":str, "args":str, "fn":callable}}
    Returns the agent's final summary text.
    """
    system = PROTOCOL.format(tools=_tools_doc(tools))
    messages = [{"role": "user", "content": f"Your task: {task}\n\nBegin."}]

    for step in range(max_steps):
        reply = complete(system, messages)
        messages.append({"role": "assistant", "content": reply})
        parsed = _parse(reply)

        if not parsed:
            emit(name, "reasoning", detail=f"(unparseable) {reply[:120]}")
            messages.append({"role": "user", "content":
                             "That was not valid JSON. Respond with ONE json object only."})
            continue

        thought = parsed.get("thought", "")
        if thought:
            emit(name, "reasoning", detail=thought)

        if "final" in parsed:
            emit(name, "done", detail=parsed["final"])
            return parsed["final"]

        tool = parsed.get("tool", "")
        args = parsed.get("args", {}) or {}
        if tool not in tools:
            messages.append({"role": "user", "content":
                             f"No such tool '{tool}'. Pick from: {list(tools)}"})
            continue

        try:
            observation = tools[tool]["fn"](**args)
        except Exception as e:  # noqa: BLE001
            observation = f"ERROR running {tool}: {e}"
        messages.append({"role": "user", "content": f"Observation: {observation}"})

    emit(name, "done", detail="(max steps reached)")
    return "(stopped: max steps)"
