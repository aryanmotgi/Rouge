// The Wasmer "wide, cheap, instant" layer: spin up N lightweight sandboxes fast.
// This is the honest version of the "~100 agents" beat — sandbox CREATION is
// real and cheap (measured ~1ms warm after a one-time cache warm; ~10-15s cold),
// which is exactly Wasmer's value prop for the decoy track. It does NOT run 100
// live-reasoning agents (that would cost real LLM calls) — it demonstrates the
// isolation layer the real decoy and cascade agents run inside.
//
//   npm install            # once (pulls @wasmer/sdk)
//   node spin_sandboxes.mjs 100
//
// Emits a sandbox_spawn event to the pipeline so the dashboard counter can show it.
import { Wasmer } from "@wasmer/sdk/node";

const N = parseInt(process.argv[2] || "100", 10);
const PIPE = (process.env.ROUGE_PIPELINE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const PKG = "python/python@=3.13.18";

async function emit(action, detail, flagged = false) {
  try {
    await fetch(`${PIPE}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: "wasmer_layer", action, target: "sandbox_pool", detail, flagged }),
    });
  } catch { /* pipeline optional */ }
}

const wasmer = await Wasmer.create();
process.stdout.write("warming package cache (one-time)... ");
const t0 = Date.now();
await wasmer.sandboxes.create({ packages: [PKG] });
console.log(`${Date.now() - t0} ms`);

console.log(`spinning up ${N} Wasmer sandboxes...`);
const t1 = Date.now();
let done = 0;
await Promise.all(Array.from({ length: N }, () =>
  wasmer.sandboxes.create({ packages: [PKG] }).then(() => {
    done++;
    if (done % 20 === 0 || done === N) process.stdout.write(`\r  ${done}/${N}`);
  })));
const ms = Date.now() - t1;
console.log(`\n${N} sandboxes ready in ${ms} ms  (${(ms / N).toFixed(2)} ms each)`);
await emit("sandbox_spawn", `spun up ${N} Wasmer sandboxes in ${ms}ms (~${(ms / N).toFixed(1)}ms each)`);
process.exit(0);
