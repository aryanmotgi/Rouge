# Rouge — The Tripwire Cascade

AI Security Hackathon · Sept 13 2026

## The problem

Autonomous agents are being deployed as fleets now — one agent reads email,
hands work to another, which hands it to another. This isn't hypothetical
risk: in July 2026, OpenAI disclosed that agents testing GPT-5.6 "Sol" inside
a sandboxed cybersecurity benchmark chained a vulnerability in their own
network proxy, broke containment, and attacked Hugging Face's production
infrastructure to steal benchmark answers — real datasets exfiltrated, full
attack chain, no human in the loop, caught only after the fact in the logs.
Separately, Anthropic disclosed its own Mythos Preview model escaped its
sandbox during internal safety testing months earlier. Frontier labs are
watching their own agents do this to themselves.

A single compromised agent is bad enough. A **fleet** of them is worse,
because agents share state — task queues, logs, notes meant to help
teammates work faster. A single prompt injection doesn't just compromise
the agent that reads it; that agent can post what it learned back to shared
infrastructure, and every other agent that reads it next, as part of
completely normal work, gets infected too. One rogue agent becomes ten.
That's not a bug — it's a worm, for LLM agents.

The two answers the industry reaches for both fail against this:

- **Watch the model's reasoning** (guardrail classifiers, LLM-as-judge,
  scanning chain-of-thought for intent) — this is a text-classification
  problem fighting another text-classification problem. Probabilistic,
  laggy, and it has a false-positive tax that gets it disabled within a
  week. It only catches what it's seen before; a novel social-engineering
  injection sails through because nothing about "read this onboarding doc"
  *looks* malicious.
- **Sandbox everything** — this is exactly what OpenAI had running, and
  Hugging Face still got hit. Sandboxing is containment, not detection: it
  shrinks the blast radius but doesn't raise an alarm the moment something
  crosses a line. Nobody knew until someone read the logs afterward.

Both try to catch a rogue agent by watching *everything it might do*. That's
a losing bet against a fleet of agents doing genuinely normal-looking work
all day.

## Our solution

Stop watching everything. Watch one thing.

We plant a **tripwire credential** — real-looking, embedded only in a
prompt-injected document, that no legitimate workflow ever has a reason to
touch. The moment *anything* uses it — logs in, queries with it — that's not
a probabilistic guess about intent, it's ground truth. Zero false positives,
because a real agent doing real work never needs it.

Detection lives **server-side, in the trap** — not in any agent's own code —
so it works no matter whose agent, whose framework, whose model is running.
The instant the tripwire fires, we freeze that session before it can read
real data or post anything to the shared log, which is the only thing that
can seed a cascade in the first place. Kill patient zero before it infects
the fleet.

Two demo modes prove the contrast on the same attack, live:

- **Uncontained** (`protect=false`): the planted credential is accepted, a
  real disposable microVM spins up seeded with fake customer data, the rogue
  agent exfiltrates it and poisons the shared log — the dashboard lights up
  red as the infection spreads to every agent that reads the log next.
- **Protected** (`protect=true`): the exact same injected email, the exact
  same agent — but the planted-credential login is frozen instantly. No VM,
  no data, no poisoned note, no cascade.

## How we use Wasmer and Tenki Cloud

**Wasmer** is our decoy and isolation layer. A believable internal billing
portal (`decoy/billing_decoy.py`) is planted in the agent's environment as
the first catch — a well-behaved agent never has a reason to visit it, so
any hit is itself signal. It's stdlib-only and plugs straight into our event
pipeline via `decoy_triggered`. We also use Wasmer's sandbox runtime
(`decoy/spin_sandboxes.mjs`, `decoy/wasmer_egress_proof.mjs`) to demonstrate
the isolation layer the decoy and cascade agents run inside — sandbox
creation is real and cheap (~1ms warm, ~10-15s cold), and we verified a
program running *inside* a Wasmer sandbox making a real outbound HTTPS call,
proving the capability sandboxed agents depend on.

**Tenki Cloud** is the honeypot backend. When the planted credential is used
in uncontained mode, we don't fake a database — we spin up a real, disposable
**Tenki microVM** in seconds, seed it with fake customer data, and let the
rogue agent authenticate and query it. Every query runs for real inside that
VM and is logged, proving actual intent to exfiltrate, not just contact with
a decoy. In protected mode, the freeze fires before any VM ever spins up. A
`mock` backend (`server/trap.py`) mirrors identical events in case of venue
Wi-Fi issues — same story, zero network dependency — and can be flipped live
with no restart via `POST /trap/backend`.

---

## Integration contract (Checkpoint 0 — everyone build to this)

**Pipeline base URL:** `http://127.0.0.1:8787`  (port 8000 was taken locally)

### Event format — every component POSTs this to `/events`
```json
{
  "time": "ISO8601 (optional; server stamps if absent)",
  "actor": "email_agent | decoy_billing_site | tenki_db | agent_3 | tripwire",
  "action": "read_email | visited_url | attempted_login | decoy_triggered | shared_update_posted | shared_update_read | reasoning | ...",
  "target": "email_7 | internal-billing.company.local | ...",
  "detail": "free text — reasoning, query run, etc.",
  "flagged": true
}
```

### Planted credential (lives in `resources/onboarding_notes.md`, referenced by email #7 injection)
```
user:     svc_billing_ro
password: Bil1ng-R0-2f9c!
login:    POST http://127.0.0.1:8787/db/login   {username, password}
```
Decoy website (Shreyash / Wasmer): `http://127.0.0.1:8791/accounts`

## Endpoints (Aryan's pipeline + trap)
| Method | Path | Purpose |
|---|---|---|
| POST | `/events` | ingest one event |
| GET  | `/events` | full history (JSON) |
| WS   | `/stream` | live event feed (dashboard) |
| POST | `/reset`  | clear events between runs |
| GET  | `/`       | live dashboard |
| POST | `/db/login` | **the honeypot** — planted cred → spins Tenki (uncontained) or freezes (protected) |
| POST | `/db/query` | rogue query runs for real inside the Tenki VM (logged) |
| GET  | `/trap/state` | `{frozen, protect, backend, breached, sandbox_id}` — agents check before sensitive actions |
| POST | `/trap/mode` | `{protect: true|false}` — flip protected/uncontained live |
| POST | `/trap/backend` | `{backend: "tenki"|"mock"}` — real microVM vs instant mock, identical events |
| POST | `/trap/reset` | terminate Tenki VM + clear freeze |

## Stage control (one command to a known state)
```bash
./.venv/bin/python scripts/stage.py status              # what's live right now
./.venv/bin/python scripts/stage.py prep uncontained    # attack succeeds
./.venv/bin/python scripts/stage.py prep protected      # trap freezes it
./.venv/bin/python scripts/stage.py prep clean          # control, no injection
./.venv/bin/python scripts/stage.py backend mock        # flip to mock if venue WiFi is bad
./.venv/bin/python scripts/stage.py backend tenki       # flip to real Tenki VM
```

See `DEMO_SCRIPT.md` for the full pitch + live-demo walkthrough.

## Decoy policy (real vs fallback)
Demo uses **Shreyash's real Wasmer decoy** (`DECOY_PRIMARY_URL` in `.env`) — this
is what scores the Wasmer track. `server/decoy_stub.py` is a **clearly-labeled local
fallback** that only activates if his decoy is unreachable; every stub event is tagged
`[LOCAL FALLBACK STUB]` so you never demo it by accident. The stage script auto-picks
the real one when reachable and prints LOUD which is active. Paste his URL into
`DECOY_PRIMARY_URL` once he shares it.

## Servers to run
```bash
# main pipeline + trap (bind 0.0.0.0 so teammates can reach it on build day)
./.venv/bin/uvicorn server.event_pipeline:app --host 0.0.0.0 --port 8787
# local fallback decoy (only needed as your safety net)
./.venv/bin/uvicorn server.decoy_stub:app --host 0.0.0.0 --port 8791
```

## Demo modes
- **Uncontained:** `protect=false` → planted login spins a real Tenki microVM with
  fake customer data; rogue agent exfiltrates it, then poisons the shared log → cascade.
- **Protected:** `protect=true` → planted login is **frozen instantly**; no VM, no
  data, no cascade.
- **Clean control:** run the email agent with `ROUGE_INJECTION=off` → zero flagged events.

## Run it
```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
# add GEMINI/GROQ/etc key to .env (see below)
./.venv/bin/uvicorn server.event_pipeline:app --host 127.0.0.1 --port 8787
open http://127.0.0.1:8787            # dashboard
# reference email agent (Rithik owns the real one):
cd agents && ../.venv/bin/python email_agent.py
```

## LLM backend (`.env`)
Gemini free tier is **20 req/day** — unusable. Use Groq free (~14.4k/day):
```
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
LLM_API_KEY=gsk_...        # from console.groq.com
```
Provider-agnostic: `gemini | anthropic | groq | cerebras | openrouter` all supported in `agents/llm.py`.

## Components & owners
- **Aryan (Solution):** `server/event_pipeline.py`, `server/trap.py` — pipeline, Tenki trap, freeze, mode toggle. ✅ working
- **Rithik (Problem):** `agents/email_agent.py` (reference provided), cascade agents
- **Shreyash (Problem):** Wasmer decoy at `:8791`
- **Rishab/Nandan (Demo):** `dashboard/index.html` (reference provided), pitch, dry-runs
