// Proof that a program INSIDE a Wasmer sandbox can make real outbound HTTPS
// calls — the capability the decoy + cascade agents depend on. Verified working
// on 2026-09-13 (Node v24, @wasmer/sdk, network:{mode:"host"}).
//
//   npm install && node wasmer_egress_proof.mjs
//
// Note: outbound egress works under Node (host bridge). "localhost" INSIDE a
// sandbox is the sandbox, not your host — reach the host pipeline by LAN IP.
import { Wasmer } from "@wasmer/sdk/node";

const py = `
import urllib.request
req = urllib.request.Request("https://example.com",
    headers={"User-Agent": "rouge-wasmer-proof/1.0"})  # a real UA; some CDNs 403 the default
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print("EGRESS OK: HTTP", r.status, "bytes", len(r.read()))
except Exception as e:
    print("EGRESS FAILED:", type(e).__name__, str(e)[:160])
`;

const wasmer = await Wasmer.create();
const t = Date.now();
const sandbox = await wasmer.sandboxes.create({
  packages: ["python/python@=3.13.18"],
  files: { "probe.py": py },
  network: { mode: "host" }, // <-- enables outbound egress (Node host bridge)
});
console.log(`sandbox ready in ${Date.now() - t} ms`);
const out = await sandbox.command("python", ["/workspace/probe.py"]).run();
console.log(out.stdout.text().trim());
const err = out.stderr.text().trim();
if (err) console.log("stderr:", err);
process.exit(0);
