import assert from "node:assert/strict";
import test from "node:test";
import { PlaceMediaService } from "../apps/api/src/modules/places/application/place-media.service.js";
import { createPlaceImageCleanupHandler } from "../apps/worker/src/places/place-image-cleanup.js";

test("managed Place upload prepares, writes, and persists one exact typed master key", async () => {
  const calls = {
    prepared: [] as string[],
    written: [] as string[],
    persisted: [] as string[],
  };
  const places = {
    canManageOwnerMedia: async () => true,
    getImage: async () => null,
    prepareImageUpload: async (_placeId: string, _imageId: string, objectKey: string) => {
      calls.prepared.push(objectKey);
    },
    addPreparedImage: async (
      placeId: string,
      imageId: string,
      objectKey: string,
      maxImages: number,
    ) => {
      assert.equal(maxImages, 3);
      calls.persisted.push(objectKey);
      return {
        id: imageId,
        imageUrl: `/api/public/v1/places/${placeId}/images/${imageId}/content`,
        sortOrder: 0,
      };
    },
  };
  const storage = {
    put: async (key: string, body: Uint8Array, contentType: string) => {
      calls.written.push(key);
      return { key, contentType, sizeBytes: body.byteLength };
    },
    get: async () => {
      throw new Error("unused");
    },
    remove: async () => undefined,
  };
  const processor = {
    process: async () => ({
      profile: "PHOTO_STANDARD" as const,
      source: { contentType: "image/png" as const, widthPx: 1, heightPx: 1 },
      selectedVariants: ["master" as const],
      variants: [
        {
          variant: "master" as const,
          body: Uint8Array.of(1, 2, 3),
          contentType: "image/webp" as const,
          sizeBytes: 3,
          widthPx: 1,
          heightPx: 1,
        },
      ],
    }),
  };
  const service = new PlaceMediaService(
    places as never,
    { isPlatformAdmin: async () => false } as never,
    { resolve: async (value: string) => value } as never,
    storage,
    processor,
    "development",
  );

  const image = await service.addUpload("owner-1", "place-1", {
    contentType: "image/png",
    body: Uint8Array.of(1),
  });

  assert.match(
    calls.prepared[0] ?? "",
    /^development\/media\/v1\/place-photo\/place-1\/[0-9a-f-]+\/master\.webp$/,
  );
  assert.deepEqual(calls.written, calls.prepared);
  assert.deepEqual(calls.persisted, calls.prepared);
  assert.equal("objectKey" in image, false);
});

test("Place Worker accepts exact legacy and configured-scope typed keys only", async () => {
  const removed: string[] = [];
  const database = {
    placeImage: { findFirst: async () => null },
  };
  const storage = {
    remove: async (key: string) => {
      removed.push(key);
    },
  };
  const handler = createPlaceImageCleanupHandler(
    database as never,
    storage as never,
    "development",
  );
  const legacy = "place-images/place-1/image-1";
  const typed = "development/media/v1/place-photo/place-1/image-1/master.webp";

  await handler({
    id: "image-1",
    topic: "place.image.reconcile-object",
    payload: { placeId: "place-1", imageId: "image-1", objectKey: legacy },
  });
  await handler({
    id: "image-1",
    topic: "place.image.reconcile-object",
    payload: { placeId: "place-1", imageId: "image-1", objectKey: typed },
  });
  assert.deepEqual(removed, [legacy, typed]);

  const referenced = createPlaceImageCleanupHandler(
    {
      placeImage: {
        findFirst: async (query: { where: { OR: Array<{ objectKey?: string }> } }) =>
          query.where.OR.some(({ objectKey }) => objectKey === typed) ? { id: "image-1" } : null,
      },
    } as never,
    storage as never,
    "development",
  );
  await referenced({
    id: "image-1",
    topic: "place.image.reconcile-object",
    payload: { placeId: "place-1", imageId: "image-1", objectKey: typed },
  });
  assert.deepEqual(removed, [legacy, typed]);

  for (const objectKey of [
    "staging/media/v1/place-photo/place-1/image-1/master.webp",
    "development/media/v1/place-photo/place-1/image-1/card.webp",
    "development/media/v1/place-photo/other/image-1/master.webp",
  ]) {
    await assert.rejects(() =>
      handler({
        id: "image-1",
        topic: "place.image.reconcile-object",
        payload: { placeId: "place-1", imageId: "image-1", objectKey },
      }),
    );
  }
  assert.deepEqual(removed, [legacy, typed]);
});

test("Place delivery signs persisted typed keys and falls back for historical rows", async () => {
  const signed: string[] = [];
  let objectKey: string | null = "development/media/v1/place-photo/place-1/image-1/master.webp";
  const service = new PlaceMediaService(
    {
      getApproved: async () => ({ id: "place-1" }),
      getImage: async () => ({
        id: "image-1",
        imageUrl: "/api/public/v1/places/place-1/images/image-1/content",
        objectKey,
        sortOrder: 0,
      }),
    } as never,
    { isPlatformAdmin: async () => false } as never,
    { resolve: async (value: string) => value } as never,
    {
      createReadUrl: async (key: string) => {
        signed.push(key);
        return `https://signed.example/${key}`;
      },
    } as never,
    { process: async () => Promise.reject(new Error("unused")) },
    "development",
  );

  await service.deliveryUrlPublic("place-1", "image-1");
  objectKey = null;
  await service.deliveryUrlPublic("place-1", "image-1");
  assert.deepEqual(signed, [
    "development/media/v1/place-photo/place-1/image-1/master.webp",
    "place-images/place-1/image-1",
  ]);
});
