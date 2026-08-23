import { spawnSync } from "node:child_process";

const baseSha = process.env.CI_BASE_SHA?.trim();
const headSha = process.env.CI_HEAD_SHA?.trim();

if (!baseSha || !headSha) {
  console.error("CI_BASE_SHA and CI_HEAD_SHA are required for changed-file lint verification.");
  process.exit(1);
}

function ensureCommitExists(sha) {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    console.error(`Unable to resolve lint comparison commit ${sha}.`);
    process.exit(1);
  }
}

ensureCommitExists(baseSha);
ensureCommitExists(headSha);

const diff = spawnSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMR", "-z", baseSha, headSha],
  { encoding: "utf8" },
);

if (diff.status !== 0) {
  process.stderr.write(diff.stderr || "Unable to determine changed files for lint verification.\n");
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split("\0")
  .filter(Boolean)
  .filter((file) => /^(?:apps|packages)\/.+\.(?:ts|tsx)$/i.test(file));

if (files.length === 0) {
  console.log("No ESLint-managed files changed.");
  process.exit(0);
}

console.log(`Linting ${files.length} changed file(s).`);
const eslint = spawnSync("npm", ["exec", "--", "eslint", "--max-warnings=0", ...files], {
  stdio: "inherit",
});
process.exit(eslint.status ?? 1);
