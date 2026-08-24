import { spawnSync } from "node:child_process";

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `git ${args.join(" ")} failed`;
    throw new Error(detail);
  }
  return result.stdout;
}

function ensureCommitExists(sha, cwd) {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
    cwd,
    stdio: "ignore",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to resolve comparison commit ${sha}.`);
  }
}

export function getChangedFiles({ baseSha, headSha, cwd = process.cwd() }) {
  if (!baseSha || !headSha) {
    throw new Error("Both baseSha and headSha are required for changed-file verification.");
  }

  ensureCommitExists(baseSha, cwd);
  ensureCommitExists(headSha, cwd);

  const mergeBase = runGit(["merge-base", baseSha, headSha], cwd).trim();
  if (!mergeBase) {
    throw new Error(`Unable to determine merge base for ${baseSha} and ${headSha}.`);
  }

  const output = runGit(
    ["diff", "--name-only", "--diff-filter=ACMR", "-z", mergeBase, headSha],
    cwd,
  );

  return output.split("\0").filter(Boolean);
}
