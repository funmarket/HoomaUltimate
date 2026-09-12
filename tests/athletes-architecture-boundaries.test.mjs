import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Whistle depends on the narrow Athletes content authorizer", async () => {
  const whistle = await source("apps/api/src/modules/whistle/application/whistle.service.ts");
  assert.match(whistle, /AthletesMemberContentAuthorizer/);
  assert.doesNotMatch(whistle, /athletes\.service\.js/);
});

test("Athletes Photo application service uses explicit authorization and unit-of-work ports", async () => {
  const photos = await source(
    "apps/api/src/modules/athletes/application/athletes-photo.service.ts",
  );
  assert.match(photos, /AthletesContentAuthorizer/);
  assert.match(photos, /AthletesPhotoUnitOfWork/);
  assert.doesNotMatch(photos, /Pick<\s*AthletesService/);
  assert.doesNotMatch(photos, /athletes\.service\.js/);
});

test("Prisma Athletes Photo infrastructure never re-enters AthletesService", async () => {
  const repository = await source(
    "apps/api/src/modules/athletes/infrastructure/prisma-athletes-photo.repository.ts",
  );
  assert.match(repository, /AthletesPhotoUnitOfWork/);
  assert.match(repository, /withCommunityLock/);
  assert.doesNotMatch(repository, /AthletesService/);
  assert.doesNotMatch(repository, /athletes\.service\.js/);
});

test("Athletes consumes Identity last-seen only through the narrow application reader", async () => {
  const athletes = await source("apps/api/src/modules/athletes/application/athletes.service.ts");
  assert.match(athletes, /UserLastSeenReader/);
  assert.match(athletes, /findLastSeenByUserIds/);
  assert.doesNotMatch(athletes, /@hooma\/database|Prisma|webSession/);

  const reader = await source("apps/api/src/modules/identity/application/user-last-seen.reader.ts");
  assert.match(reader, /findLastSeenByUserIds/);
});
