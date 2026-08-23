import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { getChangedFiles } from "../scripts/changed-files.mjs";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function commitFile(cwd, file, contents, message) {
  await writeFile(path.join(cwd, file), contents, "utf8");
  git(cwd, "add", file);
  git(cwd, "commit", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

test("changed-file detection excludes concurrent base-only changes", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "hooma-ci-changed-files-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.email", "ci-test@hooma.local");
  git(cwd, "config", "user.name", "HOOMA CI Test");

  const initial = await commitFile(cwd, "shared.txt", "initial\n", "initial");

  git(cwd, "checkout", "-b", "feature");
  const featureHead = await commitFile(cwd, "feature.txt", "feature\n", "feature change");

  git(cwd, "checkout", "main");
  const currentBase = await commitFile(cwd, "base-only.txt", "base only\n", "concurrent base change");

  assert.notEqual(initial, currentBase);
  assert.deepEqual(getChangedFiles({ baseSha: currentBase, headSha: featureHead, cwd }), [
    "feature.txt",
  ]);
});

test("changed-file detection fails closed for an unknown comparison commit", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "hooma-ci-changed-files-invalid-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.email", "ci-test@hooma.local");
  git(cwd, "config", "user.name", "HOOMA CI Test");
  const head = await commitFile(cwd, "shared.txt", "initial\n", "initial");

  assert.throws(
    () => getChangedFiles({ baseSha: "0000000000000000000000000000000000000001", headSha: head, cwd }),
    /Unable to resolve comparison commit/,
  );
});
