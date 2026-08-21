import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

const requiredDirectories = [
  "apps/api",
  "apps/web",
  "apps/telegram",
  "apps/worker",
  "packages/auth",
  "packages/config",
  "packages/contracts",
  "packages/database",
  "packages/domain",
  "packages/storage",
  "packages/testing",
  "packages/ui"
];

test("greenfield workspace owns the locked app/package topology", async () => {
  await Promise.all(requiredDirectories.map((directory) => access(path.join(root, directory))));
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(packageJson.workspaces, ["apps/*", "packages/*"]);
});

test("foundation documentation rejects donor-repository inheritance", async () => {
  const structure = await readFile(path.join(root, "structure.md"), "utf8");
  assert.match(structure, /new application built from zero/i);
  assert.match(structure, /No donor migration chain is the target migration chain/i);
});
