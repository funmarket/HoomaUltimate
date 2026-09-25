import assert from "node:assert/strict";
import test from "node:test";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import type {
  HelpRequestImageRecord,
  RequestImageRepository,
} from "../apps/api/src/modules/requests/application/request-image.repository.js";
import { RequestMediaService } from "../apps/api/src/modules/requests/application/request-media.service.js";
import type {
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

const now = new Date("2026-09-23T12:00:00.000Z");

function requestRecord(overrides: Partial<HelpRequestRecord> = {}): HelpRequestRecord {
  return {
    id: "request-1",
    createdByUserId: "owner",
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    category: "ITEM",
    itemKind: null,
    requestType: "SPORT",
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
    customNeed: null,
    taxonomySubcategory: {
      id: "hts-football-equipment",
      slug: "equipment",
      label: "Equipment",
    },
    taxonomyNeed: {
      id: "htn-football-ball",
      slug: "football",
      label: "Football",
      kind: "PRODUCT",
      allowsCustomText: false,
    },
    title: "Need a football",
    description: "Looking for a football for local training.",
    quantityNeeded: 1,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: "Tunis",
    houma: null,
    fullAddress: null,
    locationNote: null,
    image: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function requestRepository(record = requestRecord()): RequestRepository {
  return {
    create: async () => record,
    listPublic: async () => ({ items: [record], nextCursor: null }),
    getPublic: async (id) =>
      id === record.id && record.audienceScope === "PUBLIC" ? record : null,
    listVisibleToMember: async () => ({ items: [record], nextCursor: null }),
    getVisibleToMember: async (_userId, id) => (id === record.id ? record : null),
    getById: async (id) => (id === record.id ? record : null),
    createResponse: async () => null,
    listResponses: async () => [],
    getResponseById: async () => null,
    getResponseByResponder: async () => null,
    acceptResponse: async () => null,
    declineResponse: async () => null,
    withdrawResponse: async () => null,
    transitionRequestStatus: async () => null,
    expireDue: async () => 0,
  };
}

function visibility(): RequestVisibilityReader {
  return {
    communityRole: async () => null,
    teamResponsibility: async () => null,
    athletesRole: async () => null,
    isCommunityMember: async () => false,
    isAthletesMember: async () => false,
  };
}

function imageRecord(overrides: Partial<HelpRequestImageRecord> = {}): HelpRequestImageRecord {
  return {
    id: "image-1",
    requestId: "request-1",
    source: "UPLOAD",
    objectKey: "request-images/request-1/image-1",
    externalUrl: null,
    contentType: "image/webp",
    sizeBytes: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function imageRepository() {
  let current: HelpRequestImageRecord | null = null;
  const prepared: Array<{ mediaId: string; requestId: string; objectKey: string }> = [];
  const repository: RequestImageRepository = {
    prepareUpload: async (mediaId, requestId, objectKey) => {
      prepared.push({ mediaId, requestId, objectKey });
    },
    replacePreparedUpload: async (input) => {
      current = imageRecord({
        requestId: input.requestId,
        source: "UPLOAD",
        objectKey: input.objectKey,
        externalUrl: null,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      });
      return current;
    },
    replaceExternalUrl: async (requestId, url) => {
      current = imageRecord({
        requestId,
        source: "EXTERNAL_URL",
        objectKey: null,
        externalUrl: url,
        contentType: null,
        sizeBytes: null,
      });
      return current;
    },
    getForRequest: async () => current,
    deleteForRequest: async () => {
      const deleted = current;
      current = null;
      return deleted;
    },
  };
  return {
    repository,
    prepared,
    get current() {
      return current;
    },
  };
}

function storageStub() {
  const puts: string[] = [];
  const removes: string[] = [];
  const signed: string[] = [];
  const storage: ObjectStorage & ObjectStorageReadUrlSigner = {
    put: async (key, body, contentType) => {
      puts.push(key);
      return { key, contentType, sizeBytes: body.byteLength };
    },
    get: async () => {
      throw new Error("not used");
    },
    remove: async (key) => {
      removes.push(key);
    },
    createReadUrl: async (key) => {
      signed.push(key);
      return `https://storage.example.test/${encodeURIComponent(key)}?signed=1`;
    },
  };
  return { storage, puts, removes, signed };
}

test("Request media upload is owner-managed, prepared before object write, optimized and signed", async () => {
  const images = imageRepository();
  const objects = storageStub();
  const service = new RequestMediaService(
    requestRepository(),
    visibility(),
    images.repository,
    objects.storage,
    {
      process: async () => ({
        body: new Uint8Array([7, 8, 9]),
        contentType: "image/webp",
      }),
    },
  );

  const result = await service.replaceUpload("owner", "request-1", {
    contentType: "image/png",
    body: new Uint8Array([1, 2, 3, 4]),
  });

  assert.equal(images.prepared.length, 1);
  assert.equal(objects.puts.length, 1);
  assert.equal(result.source, "UPLOAD");
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.sizeBytes, 3);
  assert.equal("objectKey" in result, false);

  const delivery = await service.deliveryPublic("request-1");
  assert.match(delivery.contentUrl, /^https:\/\/storage\.example\.test\//);
  assert.ok(delivery.expiresAt);
  assert.equal(objects.signed.length, 1);
});

test("Request media supports safe external URLs through the same metadata capability", async () => {
  const images = imageRepository();
  const service = new RequestMediaService(
    requestRepository(),
    visibility(),
    images.repository,
    null,
    {
      process: async () => {
        throw new Error("not used");
      },
    },
  );

  const image = await service.replaceExternalUrl("owner", "request-1", {
    url: "https://images.example.test/request.jpg",
  });
  assert.equal(image.source, "EXTERNAL_URL");
  assert.equal(image.contentType, null);
  assert.equal(image.sizeBytes, null);
  assert.equal("externalUrl" in image, false);

  assert.deepEqual(await service.deliveryPublic("request-1"), {
    contentUrl: "https://images.example.test/request.jpg",
    expiresAt: null,
  });
});

test("Request media rejects non-owner mutation and invalid upload envelopes", async () => {
  const images = imageRepository();
  const objects = storageStub();
  const service = new RequestMediaService(
    requestRepository(),
    visibility(),
    images.repository,
    objects.storage,
    {
      process: async () => ({
        body: new Uint8Array([1]),
        contentType: "image/webp",
      }),
    },
  );

  await assert.rejects(
    () =>
      service.replaceUpload("other", "request-1", {
        contentType: "image/png",
        body: new Uint8Array([1]),
      }),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_NOT_FOUND",
  );
  await assert.rejects(
    () =>
      service.replaceUpload("owner", "request-1", {
        contentType: "image/gif",
        body: new Uint8Array([1]),
      }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
  await assert.rejects(
    () =>
      service.replaceUpload("owner", "request-1", {
        contentType: "image/png",
        body: new Uint8Array(),
      }),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_IMAGE_REQUIRED",
  );
  assert.equal(objects.puts.length, 0);
});

test("Request media deletion removes metadata and later delivery reports missing", async () => {
  const images = imageRepository();
  const service = new RequestMediaService(
    requestRepository(),
    visibility(),
    images.repository,
    storageStub().storage,
    { process: async () => ({ body: new Uint8Array([1]), contentType: "image/webp" }) },
  );

  await service.replaceExternalUrl("owner", "request-1", {
    url: "https://images.example.test/request.jpg",
  });
  await service.delete("owner", "request-1");
  await assert.rejects(
    () => service.deliveryPublic("request-1"),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_IMAGE_NOT_FOUND",
  );
});
