import { spawnSync } from "node:child_process";

const baseSha = process.env.CI_BASE_SHA?.trim();
const headSha = process.env.CI_HEAD_SHA?.trim();

if (!baseSha || !headSha) {
  console.error(
    "CI_BASE_SHA and CI_HEAD_SHA are required for changed-file formatting verification.",
  );
  process.exit(1);
}

const supportedExtension = /\.(?:ts|tsx|js|mjs|json|css|md|yml|yaml)$/i;
const supportedRoot = /^(?:apps|packages|scripts|tests|\.github)\//;

function ensureCommitExists(sha) {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    console.error(`Unable to resolve formatting comparison commit ${sha}.`);
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
  process.stderr.write(
    diff.stderr || "Unable to determine changed files for formatting verification.\n",
  );
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split("\0")
  .filter(Boolean)
  .filter(
    (file) => supportedExtension.test(file) && (supportedRoot.test(file) || !file.includes("/")),
  );

if (files.length === 0) {
  console.log("No Prettier-managed files changed.");
  process.exit(0);
}

console.log(`Checking formatting for ${files.length} changed file(s).`);
const prettier = spawnSync("npm", ["exec", "--", "prettier", "--check", ...files], {
  stdio: "inherit",
});
process.exit(prettier.status ?? 1);
