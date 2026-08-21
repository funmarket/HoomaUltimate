import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "unit";
const entries = await readdir(new URL("../tests/", import.meta.url));
const integration = entries.filter((name) => name.endsWith(".integration.test.ts")).sort();
const unit = entries
  .filter((name) => (name.endsWith(".test.ts") || name.endsWith(".test.mjs")) && !name.endsWith(".integration.test.ts"))
  .sort();
const files = mode === "integration" ? integration : unit;
if (!files.length) process.exit(0);
const args = ["tsx", "--test", ...(mode === "integration" ? ["--test-concurrency=1"] : []), ...files.map((name) => `tests/${name}`)];
const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
