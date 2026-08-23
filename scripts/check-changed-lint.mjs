import { spawnSync } from "node:child_process";
import { getCiChangedFiles } from "./changed-files.mjs";

let files;
try {
  files = getCiChangedFiles().filter((file) => /^(?:apps|packages)\/.+\.(?:ts|tsx)$/i.test(file));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (files.length === 0) {
  console.log("No ESLint-managed files changed.");
  process.exit(0);
}

console.log(`Linting ${files.length} changed file(s).`);
const eslint = spawnSync("npm", ["exec", "--", "eslint", "--max-warnings=0", ...files], {
  stdio: "inherit",
});
process.exit(eslint.status ?? 1);
