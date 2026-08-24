import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const required = [
  "packages/database/prisma/schema.prisma",
  "packages/database/prisma/migrations/20260821160000_initial_identity_foundation/migration.sql",
  "apps/api/src/modules/identity/domain/auth-context.ts",
  "apps/api/src/modules/identity/application/identity.service.ts",
  "apps/api/src/modules/identity/application/identity.repository.ts",
  "apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts",
  "apps/api/src/modules/identity/http/auth.middleware.ts",
];

test("Phase 1 identity slice uses the locked layered structure", async () => {
  await Promise.all(required.map((path) => access(path)));
});
test("fresh schema keeps the identity foundation without premature donor-domain dumping", async () => {
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
  ])
    assert.match(schema, new RegExp(`model ${model}\\b`));
  assert.doesNotMatch(schema, /model UltrasGroup\b|model GamerSquad\b|model Whistle\b/);
});
test("Whistle body persistence is not introduced by foundation schema", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  assert.doesNotMatch(schema, /whistleBody|messageBody/i);
});
