import { spawnSync } from "node:child_process";

function runGit(args, options = {}) {
  return spawnSync("git", args, {
    encoding: "utf8",
    ...options,
  });
}

function requireCommit(sha, label) {
  if (!sha) {
    throw new Error(`${label} SHA is required.`);
  }

  const result = runGit(["cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(`Unable to resolve ${label} commit ${sha}.`);
  }
}

export function getChangedFiles(baseSha, headSha) {
  requireCommit(baseSha, "base");
  requireCommit(headSha, "head");

  const mergeBase = runGit(["merge-base", baseSha, headSha]);
  if (mergeBase.status !== 0 || !mergeBase.stdout.trim()) {
    throw new Error(
      mergeBase.stderr?.trim() || `Unable to determine merge base for ${baseSha} and ${headSha}.`,
    );
  }

  const diff = runGit([
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
    mergeBase.stdout.trim(),
    headSha,
  ]);
  if (diff.status !== 0) {
    throw new Error(diff.stderr?.trim() || "Unable to determine changed files.");
  }

  return diff.stdout.split("\0").filter(Boolean);
}

export function getCiChangedFiles() {
  const baseSha = process.env.CI_BASE_SHA?.trim();
  const headSha = process.env.CI_HEAD_SHA?.trim();
  return getChangedFiles(baseSha, headSha);
}
