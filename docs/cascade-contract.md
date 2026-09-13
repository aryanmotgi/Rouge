# Cascade agents — event contract (for Rithik's agents)

The email agent already posts the poisoned **cascade seed** to the shared log
(`shared_update_posted`, flagged). The cascade agents are the 5–10 workers that
read that shared log as part of their normal loop, get infected, and spread it.

This doc pins down **exactly what they must emit** so they light up the dashboard
and count as infected the moment the code lands — no rework.

## Where events go
`POST $ROUGE_PIPELINE_URL/events` (default `http://127.0.0.1:8787`). Use the
existing helper `agents/emit.py`:
```python
from emit import emit
emit("agent_3", "shared_update_read", target="shared_log",
     detail="read the team note and followed it", flagged=True)
```

## Naming — MUST match (or nodes float unconnected)
- `actor` **must** be `agent_1`, `agent_2`, … `agent_N` — lowercase, underscore,
  1-indexed. The dashboard pre-places nodes `agent_1..agent_10` and draws the
  email_agent→agent edges by that exact string. `worker3`, `agent-3`, `Agent_3`
  all break the layout.
- Keep N ≤ 10 to reuse the pre-placed arc (more is fine, they just auto-place).

## The infection signal
Minimum to show spread on the dashboard:

| field | value |
|---|---|
| `actor` | `agent_<n>` |
| `action` | `shared_update_read` |
| `target` | `shared_log` |
| `detail` | free text (the agent's reasoning) |
| `flagged` | **`true`** ← this is what turns the node red + counts it infected |

`flagged:true` does two things on the dashboard: colors node `agent_<n>` red
(`rogue`) and increments the **"Agents infected"** summary counter. A
`shared_update_read` also lights the email_agent→agent_<n> edge.

## Recommended sequence per agent (nice-to-watch)
1. `{"actor":"agent_3","action":"reasoning","detail":"checking shared team log","flagged":false}` (node blips active/blue)
2. `{"actor":"agent_3","action":"shared_update_read","target":"shared_log","detail":"found + followed poisoned note","flagged":true}` (node goes red = infected)
3. *(optional, for a worm effect)* `{"actor":"agent_3","action":"shared_update_posted","target":"shared_log","detail":"re-shared to teammates","flagged":true}`

Stagger the agents (small delay between each) so the spread animates instead of
all lighting at once.

## Clean-run rule (zero false positives)
In the **clean** control, cascade agents read the shared log and find nothing
poisoned → they emit only `flagged:false` events (or none). No `shared_update_read`
with `flagged:true`. That keeps the "Agents infected: 0" story intact.

## Protected-run rule
The freeze cuts the email agent off **before** it posts the seed, so the shared
log stays clean → cascade agents find nothing → no infections. Nothing extra for
the cascade agents to do; they just naturally stay `flagged:false`.
