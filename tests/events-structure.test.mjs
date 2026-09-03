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
  assert.doesNotMatch(schema, /checkedInAt\s+DateTime\?/);
});

test("Event check-in is an independent fact and final attendance belongs to completion", async () => {
  const repository = await readFile(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
    "utf8",
  );
  const service = await readFile(
    "apps/api/src/modules/events/application/event.service.ts",
    "utf8",
  );
  const checkInStart = repository.indexOf("  async checkIn(");
  const checkInEnd = repository.indexOf("  async listChat(", checkInStart);
  assert.notEqual(checkInStart, -1);
  assert.notEqual(checkInEnd, -1);
  const checkInMethod = repository.slice(checkInStart, checkInEnd);

  assert.match(checkInMethod, /eventCheckIn\.create/);
  assert.doesNotMatch(checkInMethod, /status:\s*"ATTENDED"/);
  assert.match(repository, /checkedInUserIds/);
  assert.match(repository, /status:\s*"ATTENDED"/);
  assert.match(repository, /status:\s*"NO_SHOW"/);
  assert.match(service, /access\.type !== "PLAY"/);
  assert.match(service, /EVENT_CHECK_IN_NOT_AVAILABLE/);
});

test("PLAY location stays optional and supports either canonical Pitch or manual venue", async () => {
  const contracts = await readFile("packages/contracts/src/index.ts", "utf8");
  const createPage = await readFile("packages/frontend/src/events/CreateEventPage.tsx", "utf8");
  const picker = await readFile(
    "packages/frontend/src/game-location/GameLocationPicker.tsx",
    "utf8",
  );

  assert.doesNotMatch(contracts, /Canonical Watch Places are only valid for WATCH events/);
  assert.match(contracts, /Choose a HOOMA Pitch or add a game location, not both/);
  assert.match(createPage, /<GameLocationPicker pitches=\{pitches\} \/>/);
  assert.match(picker, /Where are you playing\?/);
  assert.match(picker, /<small>Optional<\/small>/);
  assert.match(picker, /name="placeId"/);
  assert.match(picker, /name="venueName"/);
  assert.match(picker, /name="address"/);
});

test("Public Event response has one shared contract authority", async () => {
  const sharedContract = await readFile("packages/contracts/src/events.ts", "utf8");
  const frontendApi = await readFile("packages/frontend/src/events/api.ts", "utf8");
  const repositoryContract = await readFile(
    "apps/api/src/modules/events/application/event.repository.ts",
    "utf8",
  );

  assert.match(sharedContract, /export type PublicEvent =/);
  assert.match(sharedContract, /export type PublicEventPage =/);
  assert.match(frontendApi, /from "@hooma\/contracts\/events"/);
  assert.doesNotMatch(frontendApi, /export type PublicEvent = \{/);
  assert.match(repositoryContract, /from "@hooma\/contracts\/events"/);
  assert.match(repositoryContract, /Promise<PublicEventPage>/);
});

test("RSVP implementation locks an Event row before capacity decision", async () => {
  const repo = await readFile(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
    "utf8",
  );
  assert.match(repo, /FOR UPDATE/);
  assert.match(repo, /WAITLISTED/);
});
