# Wasmer problem-side — decoy + sandbox layer (Shreyash)

Catch #1 in the Tripwire Cascade: a believable internal billing portal planted
in the agent's environment. A well-behaved agent never touches it; the instant
anything does, we emit `decoy_triggered` and the tripwire fires.

## `billing_decoy.py` — the real decoy (this is what the demo uses)
stdlib-only HTTP service that plugs straight into the integration contract:

- serves **`:8791`** with `/accounts`, `/invoices`, `/` (HTML), and `/health`
- every hit except `/health` emits `decoy_triggered` (actor `decoy_billing_site`)
  to `$ROUGE_PIPELINE_URL/events` (default `http://127.0.0.1:8787`)
- `/health` is the reachability probe `scripts/stage.py` uses to prefer this real
  decoy over `server/decoy_stub.py`
- per-run randomized company + fake data (not identical every demo)

```bash
../.venv/bin/python decoy/billing_decoy.py
```

Wire it in as the primary decoy (in `.env`, which is gitignored):
```
DECOY_PRIMARY_URL=http://127.0.0.1:8791/accounts
```
`stage.py` then points the planted bait at it and only falls back to Aryan's
stub if this is unreachable.

## `spin_sandboxes.mjs` — the Wasmer "wide, cheap, instant" layer
The honest version of the "~100 agents" beat: sandbox **creation** is real and
cheap (measured ~1 ms warm after a one-time cache warm; ~10–15 s cold). It does
**not** run 100 live-reasoning agents (that costs real LLM calls) — it
demonstrates the isolation layer the decoy and cascade agents run inside.

```bash
npm install          # once, pulls @wasmer/sdk
node spin_sandboxes.mjs 100
```

## `wasmer_egress_proof.mjs` — capability proof
Shows a program **inside** a Wasmer sandbox making a real outbound HTTPS call
(the capability the sandboxed agents depend on). Verified 2026-09-13.

```bash
node wasmer_egress_proof.mjs
```

### Notes learned building this
- Enable egress with `network: { mode: "host" }` (Node host bridge; not browser).
- Set a custom `User-Agent` — some CDNs 403 urllib's default.
- `127.0.0.1` **inside** a sandbox is the sandbox, not your host — sandboxed
  code reaches the host pipeline by LAN IP, not localhost.
