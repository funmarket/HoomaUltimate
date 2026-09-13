import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Athletes Calendar remains inside the Athletes boundary", async () => {
  const service = await source(
    "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
  );
  const repository = await source(
    "apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.ts",
  );
  const combined = `${service}\n${repository}`;

  assert.match(service, /AthletesContentAuthoriz/);
  assert.match(service, /AthletesCalendarUnitOfWork/);
  assert.match(repository, /withCommunityLock/);
  assert.match(repository, /PrismaAthletesRepository/);
  assert.doesNotMatch(
    combined,
    /modules\/(events|play|watch|pitch|gamers)|@hooma\/contracts\/(events|play|watch|pitch|gamers)/,
  );
});

test("Athletes Calendar reads do not claim a lifecycle lock while mutations do", async () => {
  const service = await source(
    "apps/api/src/modules/athletes/application/athletes-calendar.service.ts",
  );
  const list = service.slice(service.indexOf("async list("), service.indexOf("  create("));
  const mutations = service.slice(service.indexOf("  create("));

  assert.match(list, /requireMemberContent/);
  assert.match(list, /repository\.listForCommunity/);
  assert.doesNotMatch(list, /withCommunityLock/);
  assert.match(mutations, /withCommunityLock/);
  assert.match(mutations, /requireFounderContent/);
});

test("Athletes Calendar uses the device-resolved IANA timezone and no geographic product default", async () => {
  const time = await source("packages/frontend/src/athletes/athletes-calendar-time.ts");
  const component = await source("packages/frontend/src/athletes/AthletesCalendar.tsx");

  assert.match(time, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(time, /return resolved && isIanaTimezone\(resolved\) \? resolved : "UTC"/);
  assert.match(component, /useMemo\(deviceTimezone, \[\]\)/);
  assert.match(component, /from this phone\/device/);
});

test("ADR-057 states the actual read and mutation locking contract", async () => {
  const adr = await source("docs/adr/ADR-057-athletes-calendar.md");
  assert.match(adr, /reads do not acquire the Athletes lifecycle row lock/i);
  assert.match(adr, /mutations.*FOR UPDATE/i);
  assert.match(adr, /Founder.*same transaction/i);
  assert.match(adr, /AthletesCalendarEntry/);
  assert.doesNotMatch(adr, /shared read lock/i);
});
