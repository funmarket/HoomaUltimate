import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { getChangedFiles } from "./changed-files.mjs";

const baseSha = process.env.CI_BASE_SHA?.trim();
const headSha = process.env.CI_HEAD_SHA?.trim();

let changedFiles;
try {
  changedFiles = getChangedFiles({ baseSha, headSha });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const supportedExtension = /\.(?:ts|tsx|js|mjs|json|css|md|yml|yaml)$/i;
const supportedRoot = /^(?:apps|packages|scripts|tests|\.github)\//;
const files = changedFiles.filter(
  (file) => supportedExtension.test(file) && (supportedRoot.test(file) || !file.includes("/")),
);

if (files.length === 0) {
  console.log("No Prettier-managed files changed.");
  process.exit(0);
}

const target = "apps/api/src/modules/identity/http/auth.middleware.ts";
const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", target], {
  stdio: "inherit",
});
if (prettier.status !== 0) process.exit(prettier.status ?? 1);
console.log("--- PRETTIER OUTPUT START ---");
console.log(readFileSync(target, "utf8"));
console.log("--- PRETTIER OUTPUT END ---");
process.exit(1);
