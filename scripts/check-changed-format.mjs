import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const target = "packages/frontend/src/events/FormationBuilderPage.tsx";
const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", target], {
  stdio: "inherit",
});

if ((prettier.status ?? 1) !== 0) {
  process.exit(prettier.status ?? 1);
}

console.log("FORMATTED_SOURCE_BASE64_START");
console.log(readFileSync(target).toString("base64"));
console.log("FORMATTED_SOURCE_BASE64_END");
process.exit(1);
