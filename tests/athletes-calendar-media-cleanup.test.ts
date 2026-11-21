import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETES_CALENDAR_MEDIA_RECONCILE_TOPIC } from "@hooma/contracts/athletes";
import { buildMediaObjectKey } from "@hooma/media-processing";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { createAthletesCalendarMediaCleanupHandler } from "../apps/worker/src/athletes/athletes-calendar-media-cleanup.js";

function fixture(referenced: boolean) {
  const queries: unknown[] = [];
  const removes: string[] = [];
  const database = {
    athletesCalendarEntry: {
      findFirst: async (query: unknown) => {
        queries.push(query);
        return referenced ? { id: "entry-1" } : null;
      },
    },
  };
  const storage = {
    remove: async (objectKey: string) => {
      removes.push(objectKey);
    },
  };
  const handler = createAthletesCalendarMediaCleanupHandler(
    database as unknown as PrismaClient,
    storage as unknown as ObjectStorage,
    "staging",
  );
  return { handler, queries, removes };
}

function event(
  objectKey: string,
  overrides: { eventId?: string; mediaId?: string; communityId?: string } = {},
) {
  const mediaId = overrides.mediaId ?? "media-1";
  return {
    id: overrides.eventId ?? mediaId,
    topic: ATHLETES_CALENDAR_MEDIA_RECONCILE_TOPIC,
    payload: {
      mediaId,
      athletesCommunityId: overrides.communityId ?? "ath-1",
      objectKey,
      contentType: "image/webp" as const,
      sizeBytes: 3,
    },
  };
}

test("Athletes Calendar cleanup removes exact unreferenced legacy and typed keys", async () => {
  const state = fixture(false);
  const legacy = "athletes-calendar-media/ath-1/media-1";
  const typed = buildMediaObjectKey({
    scope: "staging",
    namespace: "ATHLETES_CALENDAR",
    ownerId: "ath-1",
    mediaId: "media-1",
    variant: "master",
  });

  await state.handler(event(legacy));
  await state.handler(event(typed));
  assert.deepEqual(state.removes, [legacy, typed]);
  assert.equal(state.queries.length, 2);
});

test("Athletes Calendar cleanup keeps bytes while media id or exact key remains referenced", async () => {
  const state = fixture(true);
  const typed = buildMediaObjectKey({
    scope: "staging",
    namespace: "ATHLETES_CALENDAR",
    ownerId: "ath-1",
    mediaId: "media-1",
    variant: "master",
  });
  await state.handler(event(typed));
  assert.deepEqual(state.removes, []);
  assert.deepEqual(state.queries, [
    {
      where: {
        athletesCommunityId: "ath-1",
        OR: [{ photoMediaId: "media-1" }, { photoObjectKey: typed }],
      },
      select: { id: true },
    },
  ]);
});

test("Athletes Calendar cleanup rejects mismatched identity, scope, namespace, variant, and unsafe keys", async () => {
  const state = fixture(false);
  const invalid = [
    "production/media/v1/athletes-calendar/ath-1/media-1/master.webp",
    "staging/media/v1/request-photo/ath-1/media-1/master.webp",
    "staging/media/v1/athletes-calendar/ath-2/media-1/master.webp",
    "staging/media/v1/athletes-calendar/ath-1/media-2/master.webp",
    "staging/media/v1/athletes-calendar/ath-1/media-1/thumb.webp",
    "athletes-calendar-media/ath-1/media-1/nested",
    "athletes-calendar-media/ath-1/../media-1",
  ];
  for (const objectKey of invalid) {
    await assert.rejects(() => state.handler(event(objectKey)), /outside the ownership boundary/);
  }
  await assert.rejects(
    () =>
      state.handler(event("athletes-calendar-media/ath-1/media-1", { eventId: "different-event" })),
    /outside the ownership boundary/,
  );
  assert.deepEqual(state.removes, []);
  assert.deepEqual(state.queries, []);
});
