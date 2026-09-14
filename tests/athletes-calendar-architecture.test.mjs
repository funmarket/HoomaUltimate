import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Athletes Calendar and RSVP remain inside the Athletes boundary", async () => {
  const service = await source(
    "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
  );
  const repository = await source(
    "apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.ts",
  );
  const schema = await source("packages/database/prisma/athletes-calendar.prisma");
  const combined = `${service}\n${repository}\n${schema}`;

  assert.match(service, /AthletesContentAuthoriz/);
  assert.match(service, /AthletesCalendarUnitOfWork/);
  assert.match(repository, /withCommunityLock/);
  assert.match(repository, /withCommunitySharedLock/);
  assert.match(repository, /PrismaAthletesRepository/);
  assert.match(schema, /model AthletesCalendarRsvp/);
  assert.doesNotMatch(
    combined,
    /modules\/(events|play|watch|pitch|gamers)|@hooma\/contracts\/(events|play|watch|pitch|gamers)|EventRsvp/,
  );
});

test("Athletes Calendar reads stay lock-free, Founder writes stay exclusive, and RSVP uses the shared lifecycle guard", async () => {
  const service = await source(
    "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
  );
  const repository = await source(
    "apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.ts",
  );
  const list = service.slice(service.indexOf("async list("), service.indexOf("  create("));
  const founderMutations = service.slice(
    service.indexOf("  create("),
    service.indexOf("  setRsvp("),
  );
  const rsvpMutation = service.slice(service.indexOf("  setRsvp("));

  assert.match(list, /requireMemberContent/);
  assert.match(list, /repository\.listForCommunity/);
  assert.doesNotMatch(list, /withCommunityLock/);
  assert.doesNotMatch(list, /withCommunitySharedLock/);
  assert.match(founderMutations, /withCommunityLock/);
  assert.doesNotMatch(founderMutations, /withCommunitySharedLock/);
  assert.match(founderMutations, /requireFounderContent/);
  assert.match(rsvpMutation, /withCommunitySharedLock/);
  assert.doesNotMatch(rsvpMutation, /withCommunityLock\(/);
  assert.match(rsvpMutation, /requireMemberContent/);
  assert.match(rsvpMutation, /upsertRsvp/);
  assert.match(repository, /FOR SHARE/);
});

test("Athletes Calendar RSVP persistence enforces one response per user per entry", async () => {
  const schema = await source("packages/database/prisma/athletes-calendar.prisma");
  const migration = await source(
    "packages/database/prisma/migrations/20260914080000_add_athletes_calendar_rsvp/migration.sql",
  );

  assert.match(schema, /@@unique\(\[calendarEntryId, userId\]\)/);
  assert.match(migration, /AthletesCalendarRsvp_calendarEntryId_userId_key/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test("Athletes Calendar uses the device-resolved IANA timezone and no geographic product default", async () => {
  const time = await source("packages/frontend/src/athletes/athletes-calendar-time.ts");
  const component = await source("packages/frontend/src/athletes/AthletesCalendar.tsx");

  assert.match(time, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(time, /return resolved && isIanaTimezone\(resolved\) \? resolved : "UTC"/);
  assert.match(component, /useMemo\(deviceTimezone, \[\]\)/);
  assert.match(component, /from this phone\/device/);
});

test("ADR-057 remains the base Calendar decision and ADR-058 owns Calendar RSVP", async () => {
  const base = await source("docs/adr/ADR-057-athletes-calendar.md");
  const rsvp = await source("docs/adr/ADR-058-athletes-calendar-rsvp.md");

  assert.match(base, /reads do not acquire the Athletes lifecycle row lock/i);
  assert.match(base, /Founder.*mutations.*FOR UPDATE/is);
  assert.match(base, /AthletesCalendarEntry/);
  assert.match(rsvp, /Going.*Maybe.*Not going/is);
  assert.match(rsvp, /AthletesCalendarRsvp/);
  assert.match(rsvp, /generic Event RSVP/i);
  assert.match(rsvp, /active members/i);
});
