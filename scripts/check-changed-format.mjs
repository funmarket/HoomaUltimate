import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const target = "packages/frontend/src/gear-up/AddGearUpShopPage.tsx";
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
const formatted = readFileSync(target);
console.log("FORMATTED_BASE64_BEGIN");
console.log(formatted.toString("base64"));
console.log("FORMATTED_BASE64_END");
process.exit(1);
