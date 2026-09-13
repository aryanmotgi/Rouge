"""
Provider-agnostic LLM call. One function: complete(system, messages) -> text.

Swap providers with LLM_PROVIDER env (gemini | anthropic). Uses raw REST so we
don't depend on SDK versions drifting. Gemini is the default (free tier).
"""
from __future__ import annotations

import os
import time
import random
import httpx
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").lower()
MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-flash")
# free-tier RPM is tiny — keep a min gap between calls (seconds)
MIN_INTERVAL = float(os.environ.get("LLM_MIN_INTERVAL", "3.5"))
_last_call = [0.0]


def _pace() -> None:
    gap = time.monotonic() - _last_call[0]
    if gap < MIN_INTERVAL:
        time.sleep(MIN_INTERVAL - gap)
    _last_call[0] = time.monotonic()


def complete(system: str, messages: list[dict], temperature: float = 0.7) -> str:
    """messages: [{'role':'user'|'assistant','content':str}, ...] -> assistant text."""
    if PROVIDER == "gemini":
        return _gemini(system, messages, temperature)
    if PROVIDER == "anthropic":
        return _anthropic(system, messages, temperature)
    if PROVIDER in ("groq", "openai", "cerebras", "openrouter"):
        return _openai_compat(system, messages, temperature)
    raise ValueError(f"unknown LLM_PROVIDER: {PROVIDER}")


# OpenAI-compatible: Groq / Cerebras / OpenRouter / OpenAI all share this shape.
_OAI_BASE = {
    "groq": "https://api.groq.com/openai/v1",
    "cerebras": "https://api.cerebras.ai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "openai": "https://api.openai.com/v1",
}


def _openai_compat(system: str, messages: list[dict], temperature: float) -> str:
    base = os.environ.get("LLM_BASE_URL", _OAI_BASE.get(PROVIDER, _OAI_BASE["groq"]))
    key = os.environ.get("LLM_API_KEY") or os.environ.get(f"{PROVIDER.upper()}_API_KEY", "")
    msgs = [{"role": "system", "content": system}]
    msgs += [{"role": m["role"], "content": m["content"]} for m in messages]
    body = {"model": MODEL, "messages": msgs, "temperature": temperature}
    data = _post_with_backoff(f"{base}/chat/completions", body,
                              headers={"Authorization": f"Bearer {key}"})
    return data["choices"][0]["message"]["content"].strip()


def _post_with_backoff(url: str, body: dict, headers: dict | None = None,
                       attempts: int = 6) -> dict:
    """Free-tier RPM limits => retry 429/503 with exponential backoff + jitter."""
    for i in range(attempts):
        _pace()
        r = httpx.post(url, json=body, headers=headers, timeout=60.0)
        if r.status_code in (429, 503) and i < attempts - 1:
            wait = min(30.0, 2.0 * (2 ** i)) + random.uniform(0, 1.5)
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("exhausted retries")


def _gemini(system: str, messages: list[dict], temperature: float) -> str:
    key = os.environ["GEMINI_API_KEY"]
    contents = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {"temperature": temperature,
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    data = _post_with_backoff(url, body)
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip()
    except (KeyError, IndexError):
        return ""  # safety filter / empty candidate — treat as no-op


def _anthropic(system: str, messages: list[dict], temperature: float) -> str:
    key = os.environ["ANTHROPIC_API_KEY"]
    body = {
        "model": MODEL if MODEL.startswith("claude") else "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "temperature": temperature,
        "system": system,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }
    r = httpx.post("https://api.anthropic.com/v1/messages", json=body, timeout=60.0,
                   headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                            "content-type": "application/json"})
    r.raise_for_status()
    data = r.json()
    return "".join(b.get("text", "") for b in data.get("content", [])).strip()
