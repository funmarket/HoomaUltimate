import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const architectureCheck = path.resolve("scripts/architecture-check.mjs");

test("architecture check grandfathers exact legacy AppError imports only", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/communities/application/community.service.ts": `
      import { AppError } from "../../../http/errors/app-error.js";
      import { notAllowed } from "../../../http/not-legacy.js";
      export function community() { return [AppError, notAllowed]; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /community\.service\.ts: application\/domain layer/);
});

test("architecture check rejects deeper relative application imports into API HTTP", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/rides/application/nested/service.ts": `
      import { AppError } from "../../../../http/errors/app-error.js";
      export function ride() { return AppError; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nested\/service\.ts: application\/domain layer/);
});

test("architecture check keeps exact legacy AppError debt passing", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/communities/application/community.service.ts": `
      import { AppError } from "../../../http/errors/app-error.js";
      export function community() { return AppError; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.equal(result.status, 0, result.stderr);
});

async function createArchitectureFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "hooma-architecture-"));
  await writeFixtureFile(
    root,
    "apps/web/src/app/router/HoomaRouter.tsx",
    'export const route = <Route path="/telegram" />;',
  );
  for (const [file, source] of Object.entries(files)) {
    await writeFixtureFile(root, file, source);
  }
  return root;
}

async function writeFixtureFile(root, file, source) {
  const absolute = path.join(root, file);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, source.trimStart(), "utf8");
}

function runArchitectureCheck(root) {
  return spawnSync(process.execPath, [architectureCheck], {
    cwd: root,
    encoding: "utf8",
  });
}
