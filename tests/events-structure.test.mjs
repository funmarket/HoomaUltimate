import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const required = [
  "apps/api/src/modules/events/domain/event-policy.ts",
  "apps/api/src/modules/events/application/event.service.ts",
  "apps/api/src/modules/events/application/event.repository.ts",
  "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
  "apps/api/src/modules/events/http/event.routes.ts",
];

async function migrationSources() {
  const directory = "packages/database/prisma/migrations";
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFile(`${directory}/${entry.name}/migration.sql`, "utf8")),
  );
}

test("Events/Play uses the locked layered module structure", async () => {
  await Promise.all(required.map((path) => access(path)));
  const migrations = await migrationSources();
  assert.equal(
    migrations.some(
      (source) =>
        source.includes('CREATE TABLE "Event"') &&
        source.includes('CREATE TABLE "PlayEventDetails"'),
    ),
    true,
    "a committed migration must own the canonical Event and PlayEventDetails tables",
  );
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
