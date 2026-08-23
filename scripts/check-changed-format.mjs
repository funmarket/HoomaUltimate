import { spawnSync } from "node:child_process";
import { getCiChangedFiles } from "./changed-files.mjs";

const supportedExtension = /\.(?:ts|tsx|js|mjs|json|css|md|yml|yaml)$/i;
const supportedRoot = /^(?:apps|packages|scripts|tests|\.github)\//;

let files;
try {
  files = getCiChangedFiles().filter(
    (file) => supportedExtension.test(file) && (supportedRoot.test(file) || !file.includes("/")),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (files.length === 0) {
  console.log("No Prettier-managed files changed.");
  process.exit(0);
}

console.log(`Checking formatting for ${files.length} changed file(s).`);
const prettier = spawnSync("npm", ["exec", "--", "prettier", "--check", ...files], {
  stdio: "inherit",
});
process.exit(prettier.status ?? 1);
