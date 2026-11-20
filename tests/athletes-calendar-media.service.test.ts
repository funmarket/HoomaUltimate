import assert from "node:assert/strict";
import test from "node:test";
import type { ProcessedMediaResult } from "@hooma/media-processing";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import type { AthletesContentAuthorizer } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import type {
  AthletesCalendarRecord,
  AthletesCalendarRepository,
} from "../apps/api/src/modules/athletes/application/athletes-calendar.repository.js";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import type { AthletesCalendarUnitOfWork } from "../apps/api/src/modules/athletes/application/athletes-calendar.unit-of-work.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

function processedImage(variant: "master" | "card" = "master"): ProcessedMediaResult {
  return {
    profile: "PHOTO_STANDARD",
    source: { contentType: "image/png", widthPx: 2, heightPx: 2 },
    selectedVariants: [variant],
    variants: [
      {
        variant,
        body: Uint8Array.of(7, 8, 9),
        contentType: "image/webp",
        sizeBytes: 3,
        widthPx: 2,
        heightPx: 2,
      },
    ],
  };
}

function calendarRecord(objectKey: string): AthletesCalendarRecord {
  const now = new Date("2026-11-21T00:00:00.000Z");
  return {
    id: "entry-1",
    athletesCommunityId: "ath-1",
    title: "Training",
    description: null,
    location: null,
    photoUrl: null,
    photoMediaId: "media-legacy",
    photoObjectKey: objectKey,
    photoContentType: "image/webp",
    photoSizeBytes: 3,
    startsAt: now,
    endsAt: new Date(now.getTime() + 60_000),
    timezone: "UTC",
    cancelledAt: null,
    createdByUserId: "founder",
    createdAt: now,
    updatedAt: now,
  };
}

function fixture(
  options: {
    returnedKey?: (key: string) => string;
    processed?: ProcessedMediaResult;
    entry?: AthletesCalendarRecord | null;
    founderError?: AthletesError;
    memberError?: AthletesError;
  } = {},
) {
  const prepared: Array<{ mediaId: string; athletesCommunityId: string; objectKey: string }> = [];
  const completed: Array<{
    mediaId: string;
    athletesCommunityId: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
  }> = [];
  const writes: string[] = [];
  const signed: string[] = [];
  const authorizer: AthletesContentAuthorizer = {
    async requireFounderContent() {
      if (options.founderError) throw options.founderError;
    },
    async requireMemberContent() {
      if (options.memberError) throw options.memberError;
    },
  };
  const repository: AthletesCalendarRepository = {
    listForCommunity: async () => ({ items: [], nextCursor: null }),
    getForCommunity: async () => options.entry ?? null,
    prepareMediaUpload: async (mediaId, athletesCommunityId, objectKey) => {
      prepared.push({ mediaId, athletesCommunityId, objectKey });
    },
    completeMediaUpload: async (input) => {
      completed.push(input);
    },
    expeditePreparedMediaCleanup: async () => false,
  };
  const unitOfWork = {} as AthletesCalendarUnitOfWork;
  const storage: ObjectStorage & ObjectStorageReadUrlSigner = {
    put: async (key, body, contentType) => {
      writes.push(key);
      return {
        key: options.returnedKey?.(key) ?? key,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    get: async () => Uint8Array.of(),
    remove: async () => undefined,
    createReadUrl: async (key) => {
      signed.push(key);
      return `https://signed.example.test/${encodeURIComponent(key)}`;
    },
  };
  const processor = { process: async () => options.processed ?? processedImage() };
  return {
    authorizer,
    repository,
    unitOfWork,
    storage,
    processor,
    prepared,
    completed,
    writes,
    signed,
  };
}

function service(
  state: ReturnType<typeof fixture>,
  scope: "development" | "staging" | "production" | null = "staging",
  storage: ObjectStorage | null = state.storage,
) {
  return new AthletesCalendarService(
    state.authorizer,
    state.repository,
    state.unitOfWork,
    storage,
    scope,
    state.processor,
  );
}

test("Athletes Calendar upload prepares and completes one exact typed master key", async () => {
  const state = fixture();
  const result = await service(state).uploadMedia("founder", "ath-1", {
    contentType: "image/png",
    body: Uint8Array.of(1, 2, 3),
  });

  assert.equal(state.prepared.length, 1);
  assert.equal(state.completed.length, 1);
  assert.equal(state.writes.length, 1);
  assert.match(
    state.prepared[0]!.objectKey,
    /^staging\/media\/v1\/athletes-calendar\/ath-1\/[a-f0-9-]+\/master\.webp$/,
  );
  assert.equal(state.writes[0], state.prepared[0]!.objectKey);
  assert.equal(state.completed[0]!.objectKey, state.prepared[0]!.objectKey);
  assert.equal(state.completed[0]!.contentType, "image/webp");
  assert.equal(state.completed[0]!.sizeBytes, 3);
  assert.equal(result.mediaId, state.prepared[0]!.mediaId);
});

test("Athletes Calendar rejects returned-key mismatch without re-preparing or completing", async () => {
  const state = fixture({ returnedKey: (key) => `${key}-unexpected` });
  await assert.rejects(
    () =>
      service(state).uploadMedia("founder", "ath-1", {
        contentType: "image/png",
        body: Uint8Array.of(1, 2, 3),
      }),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_CALENDAR_MEDIA_UPLOAD_FAILED",
  );
  assert.equal(state.prepared.length, 1);
  assert.equal(state.completed.length, 0);
  assert.equal(state.prepared[0]!.objectKey, state.writes[0]);
});

test("Athletes Calendar rejects invalid variants and missing storage scope before persistence", async () => {
  const invalidVariant = fixture({ processed: processedImage("card") });
  await assert.rejects(
    () =>
      service(invalidVariant).uploadMedia("founder", "ath-1", {
        contentType: "image/png",
        body: Uint8Array.of(1),
      }),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_CALENDAR_MEDIA_UPLOAD_FAILED",
  );
  assert.equal(invalidVariant.prepared.length, 0);
  assert.equal(invalidVariant.writes.length, 0);

  const missingScope = fixture();
  await assert.rejects(
    () =>
      service(missingScope, null).uploadMedia("founder", "ath-1", {
        contentType: "image/png",
        body: Uint8Array.of(1),
      }),
    (error: unknown) =>
      error instanceof AthletesError &&
      error.code === "ATHLETES_CALENDAR_MEDIA_STORAGE_NOT_CONFIGURED",
  );
  assert.equal(missingScope.prepared.length, 0);
  assert.equal(missingScope.writes.length, 0);
});

test("Athletes Calendar preserves Founder and archived-community authorization before upload", async () => {
  for (const founderError of [
    new AthletesError("ATHLETES_FOUNDER_REQUIRED", "Founder required"),
    new AthletesError("ATHLETES_NOT_FOUND", "Archived community unavailable"),
  ]) {
    const state = fixture({ founderError });
    await assert.rejects(() =>
      service(state).uploadMedia("member", "ath-1", {
        contentType: "image/png",
        body: Uint8Array.of(1),
      }),
    );
    assert.equal(state.prepared.length, 0);
    assert.equal(state.writes.length, 0);
  }
});

test("Athletes Calendar signs both legacy and typed persisted keys for active members", async () => {
  const legacyKey = "athletes-calendar-media/ath-1/media-legacy";
  const legacy = fixture({ entry: calendarRecord(legacyKey) });
  const legacyDelivery = await service(legacy).mediaDelivery("member", "ath-1", "entry-1");
  assert.equal(legacy.signed[0], legacyKey);
  assert.ok(legacyDelivery.expiresAt);

  const typedKey = "staging/media/v1/athletes-calendar/ath-1/media-typed/master.webp";
  const typed = fixture({ entry: calendarRecord(typedKey) });
  await service(typed).mediaDelivery("member", "ath-1", "entry-1");
  assert.equal(typed.signed[0], typedKey);
});

test("Athletes Calendar denies managed delivery before signing for non-members", async () => {
  const state = fixture({
    entry: calendarRecord("athletes-calendar-media/ath-1/media-legacy"),
    memberError: new AthletesError("ATHLETES_MEMBER_REQUIRED", "Member required"),
  });
  await assert.rejects(() => service(state).mediaDelivery("outsider", "ath-1", "entry-1"));
  assert.deepEqual(state.signed, []);
});
