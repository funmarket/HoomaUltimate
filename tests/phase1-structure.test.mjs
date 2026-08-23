import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const required = [
  "packages/database/prisma/schema.prisma",
  "apps/api/src/modules/identity/domain/auth-context.ts",
  "apps/api/src/modules/identity/application/identity.service.ts",
  "apps/api/src/modules/identity/application/identity.repository.ts",
  "apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts",
  "apps/api/src/modules/identity/http/auth.middleware.ts",
];

async function migrationSql() {
  const root = "packages/database/prisma/migrations";
  const entries = await readdir(root, { withFileTypes: true });
  const sql = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFile(`${root}/${entry.name}/migration.sql`, "utf8")),
  );
  return sql.join("\n");
}

test("identity slice uses the locked layered structure and persisted identity foundation", async () => {
  await Promise.all(required.map((path) => access(path)));
  const migrations = await migrationSql();
  assert.match(migrations, /CREATE TABLE "User"/);
  assert.match(migrations, /CREATE TABLE "WebCredential"/);
  assert.match(migrations, /CREATE TABLE "TelegramIdentity"/);
});

test("fresh schema keeps the identity foundation without speculative unrelated identity models", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  for (const model of [
    "User",
    "UserPresentation",
    "TelegramIdentity",
    "WebCredential",
    "WebSession",
    "PlatformRoleAssignment",
    "AuditLog",
    "OutboxEvent",
  ]) {
    assert.match(schema, new RegExp(`model ${model}\\b`));
  }
  assert.doesNotMatch(schema, /model UltrasGroup\b|model GamerSquad\b/);
});

test("Whistle body persistence is not introduced by foundation schema", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  assert.doesNotMatch(schema, /whistleBody|messageBody/i);
});
