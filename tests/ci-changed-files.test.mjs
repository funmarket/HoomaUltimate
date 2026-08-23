import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const changedFilesModule = fileURLToPath(new URL("../scripts/changed-files.mjs", import.meta.url));

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("changed-file resolver reports only branch-owned files after base advances", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "hooma-ci-changed-files-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.email", "ci-test@example.invalid");
  git(cwd, "config", "user.name", "HOOMA CI Test");

  await writeFile(join(cwd, "shared.txt"), "initial\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "initial");
  git(cwd, "branch", "feature");

  await writeFile(join(cwd, "base-only.txt"), "base\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "advance base");
  const advancedBase = git(cwd, "rev-parse", "HEAD");

  git(cwd, "checkout", "feature");
  await writeFile(join(cwd, "feature-only.txt"), "feature\n");
  git(cwd, "add", ".");
  git(cwd, "commit", "-m", "feature change");
  const featureHead = git(cwd, "rev-parse", "HEAD");

  const moduleUrl = pathToFileURL(changedFilesModule).href;
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { getChangedFiles } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(getChangedFiles(${JSON.stringify(advancedBase)}, ${JSON.stringify(featureHead)})));`,
    ],
    { cwd, encoding: "utf8" },
  );

  assert.deepEqual(JSON.parse(output), ["feature-only.txt"]);
});
