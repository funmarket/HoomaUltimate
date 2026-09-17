import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "unit";
const files =
  mode === "integration"
    ? []
    : ["tests/requests-responses-contracts.test.ts"];
if (!files.length) process.exit(0);
const args = ["tsx", "--test", ...files];
const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: false,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
