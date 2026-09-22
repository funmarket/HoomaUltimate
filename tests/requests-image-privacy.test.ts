import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { requestImageUrlSchema } from "../packages/contracts/src/requests.js";
import type { RequestImageValidator } from "../apps/api/src/modules/requests/application/request-image-validator.js";
import type {
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";
import { SharpRequestImageValidator } from "../apps/api/src/modules/requests/infrastructure/sharp-request-image-validator.js";

const CREATOR = "user-1";

function record(overrides: Partial<HelpRequestRecord> = {}): HelpRequestRecord {
  return {
    id: "request-1",
    createdByUserId: CREATOR,
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    requestType: "SPORT",
    category: "ITEM",
    itemKind: null,
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
    customNeed: null,
    taxonomySubcategory: {
      id: "hts-football-equipment",
      slug: "equipment-gear",
      label: "Equipment & Gear",
    },
    taxonomyNeed: {
      id: "htn-football-ball",
      slug: "football",
      label: "Football",
      kind: "PRODUCT",
      allowsCustomText: false,
    },
    title: "Need a football",
    description: "Looking for a football for a local training session.",
    quantityNeeded: 1,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: "Tunis",
    houma: null,
    fullAddress: "12 Rue de Marseille, Tunis",
    locationNote: null,
    imageUrl: null,
    imageObjectKey: null,
    imageContentType: null,
    imageSizeBytes: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-22T00:00:00.000Z"),
    updatedAt: new Date("2026-09-22T00:00:00.000Z"),
    ...overrides,
  };
}

function visibility(): RequestVisibilityReader {
  return {
    async communityRole() {
      return null;
    },
    async teamResponsibility() {
      return null;
    },
    async athletesRole() {
      return null;
    },
    async isCommunityMember() {
      return false;
    },
    async isAthletesMember() {
      return false;
    },
  };
}

type StoredUpload = { key: string; contentType: string; sizeBytes: number };

function repository(stored: HelpRequestRecord, uploads: StoredUpload[]) {
  const calls: string[] = [];
  // Mirrors the persistence effect of an upload so a re-read after
  // `setUploadedImage` reflects the stored photo, like the real repository.
  const current: HelpRequestRecord = { ...stored };
  const implementation = {
    calls,
    async create(input: { [key: string]: unknown }) {
      calls.push("create");
      return record(input as Partial<HelpRequestRecord>);
    },
    async listPublic(input: Record<string, unknown>) {
      calls.push(`listPublic:${JSON.stringify(input)}`);
      return { items: [stored], nextCursor: null };
    },
    async getPublic() {
      calls.push("getPublic");
      return stored;
    },
    async listVisibleToMember(input: Record<string, unknown>) {
      calls.push(`listVisibleToMember:${JSON.stringify(input)}`);
      return { items: [stored], nextCursor: null };
    },
    async getVisibleToMember() {
      return stored;
    },
    async getById() {
      return current;
    },
    async setUploadedImage(_id: string, image: StoredUpload) {
      calls.push(`setUploadedImage:${JSON.stringify(image)}`);
      uploads.push(image);
      current.imageObjectKey = image.key;
      current.imageContentType = image.contentType;
      current.imageSizeBytes = image.sizeBytes;
      return { previousObjectKey: null };
    },
    async clearImage() {
      return { previousObjectKey: null };
    },
    async createResponse() {
      return null;
    },
    async listResponses() {
      return [];
    },
    async getResponseById() {
      return null;
    },
    async getResponseByResponder() {
      return null;
    },
    async acceptResponse() {
      return null;
    },
    async declineResponse() {
      return null;
    },
    async withdrawResponse() {
      return null;
    },
    async transitionRequestStatus() {
      return null;
    },
    async expireDue() {
      return 0;
    },
  };
  return implementation as unknown as RequestRepository & { calls: string[] };
}

function storage(store: StoredUpload[]) {
  return {
    async put(key: string, body: Uint8Array, contentType: string) {
      const descriptor = { key, contentType, sizeBytes: body.byteLength };
      store.push(descriptor);
      return descriptor;
    },
    async get() {
      return null;
    },
    async remove() {},
  };
}

async function pngBytes(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 12, b: 16 } },
    })
      .png()
      .toBuffer(),
  );
}

// --- image byte validation -------------------------------------------------

test("a real PNG decodes as the declared image type", async () => {
  const validator = new SharpRequestImageValidator();
  await validator.validate(await pngBytes(), "image/png");
});

test("bytes that are not the declared image type are rejected", async () => {
  const validator = new SharpRequestImageValidator();
  const png = await pngBytes();
  await assert.rejects(
    () => validator.validate(png, "image/jpeg"),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
    "a spoofed content type must not be accepted",
  );
});

test("truncated and non-image bytes are rejected", async () => {
  const validator = new SharpRequestImageValidator();
  const png = await pngBytes();
  await assert.rejects(
    () => validator.validate(png.slice(0, 24), "image/png"),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
  await assert.rejects(
    () => validator.validate(new TextEncoder().encode("not an image at all"), "image/png"),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
});

// --- upload path -----------------------------------------------------------

test("an upload without a wired decoder is refused instead of trusted", async () => {
  const stored = record();
  const service = new RequestService(
    repository(stored, []),
    visibility(),
    undefined,
    storage([]) as never,
    undefined,
    null,
  );
  await assert.rejects(
    () =>
      service.replaceImage(CREATOR, stored.id, {
        contentType: "image/png",
        body: new Uint8Array([1]),
      }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_STORAGE_UNAVAILABLE",
  );
});

test("an upload stores validated bytes and never exposes the private object key", async () => {
  const stored = record();
  const uploads: StoredUpload[] = [];
  const objects: StoredUpload[] = [];
  const repo = repository(stored, uploads);
  const service = new RequestService(
    repo,
    visibility(),
    undefined,
    storage(objects) as never,
    undefined,
    new SharpRequestImageValidator() as RequestImageValidator,
  );

  const result = await service.replaceImage(CREATOR, stored.id, {
    contentType: "image/png",
    body: await pngBytes(),
  });

  assert.equal(objects.length, 1, "the bytes reach the canonical object storage exactly once");
  assert.equal(uploads.length, 1, "the stored object metadata is persisted on the Request");
  assert.equal(uploads[0].contentType, "image/png");
  assert.equal(result.hasUploadedImage, true);
  assert.equal(Object.hasOwn(result, "imageObjectKey"), false, "the object key stays private");
  assert.equal(Object.hasOwn(result, "imageSizeBytes"), false, "stored metadata stays private");
  assert.equal(JSON.stringify(result).includes(uploads[0].key), false, "the key never serializes");
});

test("invalid bytes never reach object storage", async () => {
  const stored = record();
  const objects: StoredUpload[] = [];
  const service = new RequestService(
    repository(stored, []),
    visibility(),
    undefined,
    storage(objects) as never,
    undefined,
    new SharpRequestImageValidator() as RequestImageValidator,
  );

  await assert.rejects(
    () =>
      service.replaceImage(CREATOR, stored.id, {
        contentType: "image/png",
        body: new TextEncoder().encode("spoofed"),
      }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
  assert.equal(objects.length, 0, "rejected bytes are never stored");
});

// --- precise address privacy ----------------------------------------------

test("the precise address is released only to the Request creator", async () => {
  const stored = record({ fullAddress: "12 Rue de Marseille, Tunis" });
  const service = new RequestService(repository(stored, []), visibility());

  const publicView = await service.getPublic(stored.id);
  assert.equal(publicView.fullAddress, null, "the public projection never carries the address");

  const publicFeed = await service.listPublic({ surface: "REQUESTS" } as never);
  assert.equal(publicFeed.items[0].fullAddress, null);

  const creatorView = await service.getForMember(CREATOR, stored.id);
  assert.equal(creatorView.fullAddress, "12 Rue de Marseille, Tunis");

  const otherMemberView = await service.getForMember("user-2", stored.id);
  assert.equal(otherMemberView.fullAddress, null, "another member never receives the address");
});

// --- image URL scheme ------------------------------------------------------

test("only http and https image URLs are accepted", () => {
  assert.equal(requestImageUrlSchema.safeParse("https://cdn.example.com/a.png").success, true);
  assert.equal(requestImageUrlSchema.safeParse("http://cdn.example.com/a.png").success, true);
  for (const rejected of [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///etc/passwd",
    "ftp://cdn.example.com/a.png",
  ]) {
    assert.equal(
      requestImageUrlSchema.safeParse(rejected).success,
      false,
      `${rejected} is rejected`,
    );
  }
});

// --- surface eligibility stays server-side --------------------------------

test("the requested surface is forwarded for server-side eligibility", async () => {
  const stored = record();
  const repo = repository(stored, []);
  const service = new RequestService(repo, visibility());

  await service.listPublic({ surface: "ATHLETES" } as never);

  assert.ok(
    repo.calls.some((call) => call.startsWith("listPublic:") && call.includes('"ATHLETES"')),
    `eligibility query must reach the repository, saw ${repo.calls.join(" | ")}`,
  );
});
