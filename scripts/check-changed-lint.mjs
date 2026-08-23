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

const files = changedFiles.filter((file) => /^(?:apps|packages)\/.+\.(?:ts|tsx)$/i.test(file));

if (files.length === 0) {
  console.log("No ESLint-managed files changed.");
  process.exit(0);
}

console.log(`Linting ${files.length} changed file(s).`);
const eslint = spawnSync("npm", ["exec", "--", "eslint", "--max-warnings=0", ...files], {
  stdio: "inherit",
});
process.exit(eslint.status ?? 1);
