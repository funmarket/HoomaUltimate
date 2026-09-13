import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
  "packages/contracts/src/athletes-calendar.ts",
  "apps/api/src/modules/athletes/application/athletes-calendar.repository.ts",
  "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
  "apps/api/src/modules/athletes/application/athletes-calendar.unit-of-work.ts",
  "apps/api/src/modules/athletes/http/athletes-calendar.routes.ts",
  "apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.ts",
  "packages/frontend/src/athletes/calendar/api.ts",
  "packages/frontend/src/athletes/calendar/AthletesCalendar.tsx",
];
const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

test("Athletes Calendar stays independent from global Event product domains", () => {
  assert.doesNotMatch(source, /@hooma\/contracts\/events/);
  assert.doesNotMatch(source, /EventService|EventRsvp|PrismaEventRepository/);
  assert.doesNotMatch(source, /modules\/(events|play|watch|gamers|pitch)/);
  assert.doesNotMatch(source, /\/api\/v1\/(events|play|watch|gamers|pitch)/);
});

test("Athletes Calendar reuses Athletes authorization instead of role duplication", () => {
  const service = readFileSync(
    "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
    "utf8",
  );
  assert.match(service, /AthletesContentAuthorizer/);
  assert.match(service, /requireMemberContent/);
  assert.match(service, /requireFounderContent/);
  assert.doesNotMatch(service, /viewerRole|FOUNDER\s*===|MODERATOR\s*===/);
});

test("Athletes Calendar reuses the canonical Athletes lifecycle lock", () => {
  const repository = readFileSync(
    "apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.ts",
    "utf8",
  );
  assert.match(repository, /PrismaAthletesRepository/);
  assert.match(repository, /athletes\.withCommunityLock/);
  assert.doesNotMatch(repository, /FOR UPDATE|FOR SHARE|lockActiveCommunity/);
});
