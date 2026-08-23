import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const required = [
  "apps/api/src/modules/events/domain/event-policy.ts",
  "apps/api/src/modules/events/application/event.service.ts",
  "apps/api/src/modules/events/application/event.repository.ts",
  "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
  "apps/api/src/modules/events/http/event.routes.ts",
  "packages/database/prisma/schema.prisma",
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

test("Events/Play uses the locked layered module structure", async () => {
  await Promise.all(required.map((path) => access(path)));
  assert.match(await migrationSql(), /CREATE TABLE "Event"/);
});

test("Event schema keeps RSVP, formation, check-in, and temporary chat as explicit concepts", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  for (const model of [
    "Event",
    "PlayEventDetails",
    "EventRsvp",
    "Formation",
    "FormationSlot",
    "EventCheckIn",
    "EventChatRoom",
    "EventChatMessage",
  ]) {
    assert.match(schema, new RegExp(`model ${model}\\b`));
  }
  assert.match(schema, /expiresAt DateTime/);
});

test("RSVP implementation locks an Event row before capacity decision", async () => {
  const repo = await readFile(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
    "utf8",
  );
  assert.match(repo, /FOR UPDATE/);
  assert.match(repo, /WAITLISTED/);
});
