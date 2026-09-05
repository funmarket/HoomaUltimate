import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETES_PHOTO_MAX_BYTES } from "@hooma/contracts/athletes";
import type { ObjectStorage } from "@hooma/storage";
import type {
  AthletesPhotoCreateInput,
  AthletesPhotoRecord,
  AthletesPhotoRepository,
} from "../apps/api/src/modules/athletes/application/athletes-photo.repository.js";
import { AthletesPhotoService } from "../apps/api/src/modules/athletes/application/athletes-photo.service.js";
import type {
  AthletesCommunityRecord,
  AthletesJoinRequestRecord,
  AthletesMembershipRecord,
  AthletesRepository,
  AthletesRole,
} from "../apps/api/src/modules/athletes/application/athletes.repository.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

function community(
  id = "ath-1",
  status: "ACTIVE" | "ARCHIVED" = "ACTIVE",
): AthletesCommunityRecord {
  return {
    id,
    slug: `${id}-community`,
    name: `${id} Community`,
    sport: "RUNNING",
    description: null,
    city: "Tunis",
    houma: "Carthage",
    logoUrl: null,
    bannerUrl: null,
    visibility: "PRIVATE",
    joinPolicy: "APPROVAL_REQUIRED",
    status,
    createdByUserId: "founder",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  };
}

function membership(
  athletesCommunityId: string,
  userId: string,
  role: AthletesRole = "MEMBER",
): AthletesMembershipRecord {
  return {
    id: `mem-${athletesCommunityId}-${userId}`,
    athletesCommunityId,
    userId,
    role,
    joinedAt: new Date("2026-09-01T10:00:00.000Z"),
    leftAt: null,
  };
}

function pending(userId = "member"): AthletesJoinRequestRecord {
  return {
    id: `req-${userId}`,
    athletesCommunityId: "ath-1",
    userId,
    status: "PENDING",
    requestedAt: new Date("2026-09-01T10:00:00.000Z"),
    resolvedAt: null,
    resolvedByUserId: null,
  };
}

function athletesRepositoryStub(
  roles: Record<string, AthletesRole | null> = {},
  statusByCommunity: Record<string, "ACTIVE" | "ARCHIVED"> = {},
): AthletesRepository {
  const roleFor = (id: string, userId: string) => roles[`${id}:${userId}`] ?? null;
  return {
    listPublic: async () => ({ items: [], nextCursor: null }),
    getPublic: async (id) => community(id, statusByCommunity[id] ?? "ACTIVE"),
    createWithFounder: async (userId, input) => ({
      ...community("created-athletes"),
      createdByUserId: userId,
      name: input.name,
    }),
    update: async (id, input) => ({ ...community(id), ...input }),
    archive: async () => true,
    lifecycle: async (id) => community(id, statusByCommunity[id] ?? "ACTIVE"),
    managerRole: async (id, userId) => roleFor(id, userId),
    activeRole: async (id, userId) =>
      (statusByCommunity[id] ?? "ACTIVE") === "ACTIVE" ? roleFor(id, userId) : null,
    joinOpen: async (id, userId) => membership(id, userId),
    requestJoin: async (_id, userId) => ({ kind: "REQUEST", request: pending(userId) }),
    getJoinRequest: async () => null,
    listJoinRequests: async () => [],
    resolveJoinRequest: async () => true,
    cancelJoinRequest: async () => true,
    listMembers: async () => [],
    addMemberByUsername: async () => ({ userId: "target", username: "target" }),
    removeMember: async () => true,
    setRole: async () => true,
  };
}

function photoRecord(
  input: Partial<AthletesPhotoRecord> = {},
): AthletesPhotoRecord {
  return {
    id: "photo-1",
    athletesCommunityId: "ath-1",
    objectKey: "athletes-photos/ath-1/photo-1",
    contentType: "image/jpeg",
    sizeBytes: 3,
    uploadedByUserId: "founder",
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
    ...input,
  };
}

function photoRepositoryStub(records: AthletesPhotoRecord[] = []) {
  const created: AthletesPhotoCreateInput[] = [];
  let createFailure: Error | null = null;
  const repository: AthletesPhotoRepository = {
    create: async (input) => {
      created.push(input);
      if (createFailure) throw createFailure;
      return photoRecord({
        ...input,
        createdAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:00.000Z",
      });
    },
    listForCommunity: async (athletesCommunityId) =>
      records.filter((record) => record.athletesCommunityId === athletesCommunityId),
    getForCommunity: async (athletesCommunityId, photoId) =>
      records.find(
        (record) =>
          record.athletesCommunityId === athletesCommunityId && record.id === photoId,
      ) ?? null,
  };
  return {
    repository,
    created,
    failCreate(error: Error) {
      createFailure = error;
    },
  };
}

function storageStub() {
  const puts: Array<{ key: string; body: Uint8Array; contentType: string }> = [];
  const gets: string[] = [];
  const removes: string[] = [];
  let putFailure: Error | null = null;
  let getFailure: Error | null = null;
  let removeFailure: Error | null = null;
  let returnedKey: string | null = null;

  const storage: ObjectStorage = {
    put: async (key, body, contentType) => {
      puts.push({ key, body, contentType });
      if (putFailure) throw putFailure;
      return {
        key: returnedKey ?? key,
        contentType,
        sizeBytes: body.byteLength,
      };
    },
    get: async (key) => {
      gets.push(key);
      if (getFailure) throw getFailure;
      return {
        key,
        contentType: "image/jpeg",
        sizeBytes: 3,
        body: new Uint8Array([7, 8, 9]),
      };
    },
    remove: async (key) => {
      removes.push(key);
      if (removeFailure) throw removeFailure;
    },
  };

  return {
    storage,
    puts,
    gets,
    removes,
    failPut(error: Error) {
      putFailure = error;
    },
    failGet(error: Error) {
      getFailure = error;
    },
    failRemove(error: Error) {
      removeFailure = error;
    },
    returnKey(key: string) {
      returnedKey = key;
    },
  };
}

function photoService(
  roles: Record<string, AthletesRole | null>,
  photos: AthletesPhotoRepository,
  storage: ObjectStorage | null,
  statusByCommunity: Record<string, "ACTIVE" | "ARCHIVED"> = {},
) {
  return new AthletesPhotoService(
    new AthletesService(athletesRepositoryStub(roles, statusByCommunity)),
    photos,
    storage,
  );
}

test("AthletesPhotoService lets the same-community Founder upload each allowed MIME and returns public metadata", async () => {
  for (const contentType of ["image/jpeg", "image/png", "image/webp"] as const) {
    const photos = photoRepositoryStub();
    const objects = storageStub();
    const service = photoService(
      { "ath-1:founder": "FOUNDER" },
      photos.repository,
      objects.storage,
    );

    const body = new Uint8Array([1, 2, 3]);
    const result = await service.upload("founder", "ath-1", { contentType, body });

    assert.equal(objects.puts.length, 1);
    assert.match(objects.puts[0]!.key, /^athletes-photos\/ath-1\//);
    assert.equal(objects.puts[0]!.contentType, contentType);
    assert.deepEqual(objects.puts[0]!.body, body);
    assert.equal(photos.created.length, 1);
    assert.equal(photos.created[0]!.objectKey, objects.puts[0]!.key);
    assert.equal(photos.created[0]!.uploadedByUserId, "founder");
    assert.deepEqual(result, {
      id: photos.created[0]!.id,
      athletesCommunityId: "ath-1",
      contentType,
      sizeBytes: 3,
      createdAt: "2026-09-05T12:00:00.000Z",
      updatedAt: "2026-09-05T12:00:00.000Z",
    });
    assert.equal("objectKey" in result, false);
    assert.equal("uploadedByUserId" in result, false);
  }
});

test("AthletesPhotoService persists the descriptor returned by ObjectStorage", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  objects.returnKey("stored/ath-1/provider-photo-key");
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
  );

  await service.upload("founder", "ath-1", {
    contentType: "image/jpeg",
    body: new Uint8Array([1, 2, 3]),
  });

  assert.equal(photos.created[0]!.objectKey, "stored/ath-1/provider-photo-key");
});

test("AthletesPhotoService denies Moderator, Member, outsider, and Founder from another community uploads", async () => {
  const roles = {
    "ath-1:moderator": "MODERATOR",
    "ath-1:member": "MEMBER",
    "ath-2:other-founder": "FOUNDER",
  } satisfies Record<string, AthletesRole>;
  const photos = photoRepositoryStub();
  const objects = storageStub();
  const service = photoService(roles, photos.repository, objects.storage);

  for (const userId of ["moderator", "member", "outsider", "other-founder"]) {
    await assert.rejects(
      () =>
        service.upload(userId, "ath-1", {
          contentType: "image/jpeg",
          body: new Uint8Array([1]),
        }),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_REQUIRED",
    );
  }

  assert.equal(objects.puts.length, 0);
  assert.equal(photos.created.length, 0);
});

test("AthletesPhotoService denies upload when the Athletes community is archived", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
    { "ath-1": "ARCHIVED" },
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1]),
      }),
    (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_NOT_FOUND",
  );
  assert.equal(objects.puts.length, 0);
});

test("AthletesPhotoService rejects invalid MIME, empty bytes, and oversized bytes before storage", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/gif",
        body: new Uint8Array([1]),
      }),
    /JPEG, PNG, or WebP/,
  );
  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array(),
      }),
    /bytes are required/,
  );
  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array(ATHLETES_PHOTO_MAX_BYTES + 1),
      }),
    /5 MiB or smaller/,
  );

  assert.equal(objects.puts.length, 0);
  assert.equal(photos.created.length, 0);
});

test("AthletesPhotoService rejects upload when storage is unavailable", async () => {
  const photos = photoRepositoryStub();
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    null,
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1]),
      }),
    /storage is not configured/,
  );
  assert.equal(photos.created.length, 0);
});

test("AthletesPhotoService propagates object upload failure without attempting metadata or cleanup", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  const storageFailure = new Error("object storage down");
  objects.failPut(storageFailure);
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1]),
      }),
    (error: unknown) => error === storageFailure,
  );
  assert.equal(photos.created.length, 0);
  assert.deepEqual(objects.removes, []);
});

test("AthletesPhotoService removes the uploaded object when metadata persistence fails", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  objects.returnKey("stored/ath-1/orphan-key");
  const metadataFailure = new Error("database unavailable");
  photos.failCreate(metadataFailure);
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1, 2, 3]),
      }),
    (error: unknown) => error === metadataFailure,
  );
  assert.deepEqual(objects.removes, ["stored/ath-1/orphan-key"]);
});

test("AthletesPhotoService surfaces unreconciled orphan cleanup failure", async () => {
  const photos = photoRepositoryStub();
  const objects = storageStub();
  photos.failCreate(new Error("database unavailable"));
  objects.failRemove(new Error("cleanup unavailable"));
  const service = photoService(
    { "ath-1:founder": "FOUNDER" },
    photos.repository,
    objects.storage,
  );

  await assert.rejects(
    () =>
      service.upload("founder", "ath-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1, 2, 3]),
      }),
    (error: unknown) =>
      error instanceof AggregateError &&
      error.errors.length === 2 &&
      error.message.includes("cleanup also failed"),
  );
  assert.equal(objects.removes.length, 1);
});

test("AthletesPhotoService lets active same-community members list durable public metadata", async () => {
  const record = photoRecord();
  const photos = photoRepositoryStub([record, photoRecord({ id: "photo-2", athletesCommunityId: "ath-2" })]);
  const service = photoService(
    { "ath-1:member": "MEMBER" },
    photos.repository,
    storageStub().storage,
  );

  const result = await service.list("member", "ath-1");
  assert.deepEqual(result, [
    {
      id: "photo-1",
      athletesCommunityId: "ath-1",
      contentType: "image/jpeg",
      sizeBytes: 3,
      createdAt: "2026-09-05T12:00:00.000Z",
      updatedAt: "2026-09-05T12:00:00.000Z",
    },
  ]);
});

test("AthletesPhotoService denies list/read to outsiders, wrong-community members, and archived communities", async () => {
  const photos = photoRepositoryStub([photoRecord()]);
  const objects = storageStub();
  const activeService = photoService(
    { "ath-2:other-member": "MEMBER" },
    photos.repository,
    objects.storage,
  );

  for (const userId of ["outsider", "other-member"]) {
    await assert.rejects(
      () => activeService.list(userId, "ath-1"),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_MEMBER_REQUIRED",
    );
    await assert.rejects(
      () => activeService.read(userId, "ath-1", "photo-1"),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_MEMBER_REQUIRED",
    );
  }

  const archivedService = photoService(
    { "ath-1:member": "MEMBER" },
    photos.repository,
    objects.storage,
    { "ath-1": "ARCHIVED" },
  );
  await assert.rejects(
    () => archivedService.list("member", "ath-1"),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_MEMBER_REQUIRED",
  );
  await assert.rejects(
    () => archivedService.read("member", "ath-1", "photo-1"),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_MEMBER_REQUIRED",
  );
  assert.deepEqual(objects.gets, []);
});

test("AthletesPhotoService resolves scoped metadata before returning stored body with canonical content type", async () => {
  const photos = photoRepositoryStub([photoRecord()]);
  const objects = storageStub();
  const service = photoService(
    { "ath-1:member": "MEMBER" },
    photos.repository,
    objects.storage,
  );

  const result = await service.read("member", "ath-1", "photo-1");
  assert.deepEqual(objects.gets, ["athletes-photos/ath-1/photo-1"]);
  assert.equal(result.contentType, "image/jpeg");
  assert.deepEqual(result.body, new Uint8Array([7, 8, 9]));

  await assert.rejects(() => service.read("member", "ath-1", "missing-photo"), /not found/);
  assert.equal(objects.gets.length, 1);
});

test("AthletesPhotoService propagates object read failures for Phase 8 error mapping", async () => {
  const photos = photoRepositoryStub([photoRecord()]);
  const objects = storageStub();
  const readFailure = new Error("object unavailable");
  objects.failGet(readFailure);
  const service = photoService(
    { "ath-1:member": "MEMBER" },
    photos.repository,
    objects.storage,
  );

  await assert.rejects(
    () => service.read("member", "ath-1", "photo-1"),
    (error: unknown) => error === readFailure,
  );
});
