import fs from "node:fs";
import { spawnSync } from "node:child_process";

const target = "packages/frontend/src/events/PlayPage.tsx";
const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", target], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (prettier.error) {
  console.error(prettier.error.message);
  process.exit(1);
}
if ((prettier.status ?? 1) !== 0) {
  process.exit(prettier.status ?? 1);
}

const formatted = fs.readFileSync(target, "utf8");
console.log("HOOMA_FORMATTED_PLAYPAGE_BASE64_BEGIN");
console.log(Buffer.from(formatted, "utf8").toString("base64"));
console.log("HOOMA_FORMATTED_PLAYPAGE_BASE64_END");

// Diagnostic-only run: fail deliberately so this temporary commit cannot be merged.
process.exit(1);
