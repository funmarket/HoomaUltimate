import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const mediaServiceUrl = new URL(
  "../apps/api/src/modules/gear-up/application/gear-up-product-media.service.ts",
  import.meta.url,
);
const settingsServiceUrl = new URL(
  "../apps/api/src/modules/gear-up/application/gear-up-settings.service.ts",
  import.meta.url,
);

async function loadServices() {
  assert.equal(existsSync(mediaServiceUrl), true, "Gear Up product media service must exist");
  assert.equal(existsSync(settingsServiceUrl), true, "Gear Up settings service must exist");
  return Promise.all([import(mediaServiceUrl.href), import(settingsServiceUrl.href)]);
}

function dependencies(overrides = {}) {
  const calls = {
    external: [],
    prepare: [],
    upload: [],
    reorder: [],
    settings: [],
    adminChecks: 0,
  };
  const images = {
    list: async () => [],
    get: async () => null,
    getSettings: async () => ({ productImageLimit: 3 }),
    updateSettings: async (userId, input) => {
      calls.settings.push({ userId, input });
      return { productImageLimit: input.productImageLimit };
    },
    addExternalUrl: async (productId, url) => {
      calls.external.push({ productId, url });
      return {
        id: "image-external",
        productId,
        source: "EXTERNAL_URL",
        objectKey: null,
        externalUrl: url,
        contentType: null,
        sizeBytes: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    prepareUpload: async (imageId, productId, objectKey) => {
      calls.prepare.push({ imageId, productId, objectKey });
    },
    addPreparedUpload: async (input) => {
      calls.upload.push(input);
      return {
        id: input.imageId,
        productId: input.productId,
        source: "UPLOAD",
        objectKey: input.objectKey,
        externalUrl: null,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    delete: async () => null,
    reorder: async (productId, imageIds) => {
      calls.reorder.push({ productId, imageIds });
      return [];
    },
    ...overrides.images,
  };
  const products = {
    getManaged: async () => ({ id: "product-1", shopPlaceId: "place-1" }),
    getPublic: async () => ({ id: "product-1", shopPlaceId: "place-1" }),
    ...overrides.products,
  };
  const places = {
    hasVerifiedOwnership: async () => false,
    ...overrides.places,
  };
  const platformAdmin = {
    isPlatformAdmin: async () => false,
    requirePlatformAdmin: async () => {
      calls.adminChecks += 1;
    },
    ...overrides.platformAdmin,
  };
  const storage = overrides.storage ?? {
    put: async (key, body, contentType) => ({
      key,
      sizeBytes: body.byteLength,
      contentType,
    }),
    get: async () => new Uint8Array(),
    remove: async () => undefined,
    createReadUrl: async (key) => `https://signed.example.com/${key}`,
  };
  const processor = overrides.processor ?? {
    process: async () => ({
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
    }),
  };
  return { calls, images, products, places, platformAdmin, storage, processor };
}

test("pending submitter access cannot manage official product media", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { hasVerifiedOwnership: async () => false },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
  );

  await assert.rejects(
    () =>
      service.addExternalUrl("pending-owner", "place-1", "product-1", {
        url: "https://images.example.com/ball.webp",
      }),
    (error) => error?.code === "GEAR_UP_PRODUCT_MEDIA_MANAGE_FORBIDDEN",
  );
  assert.equal(deps.calls.external.length, 0);
});

test("verified Place owner can add external images and preserve product ownership", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { hasVerifiedOwnership: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
  );

  const image = await service.addExternalUrl("owner-1", "place-1", "product-1", {
    url: "https://images.example.com/ball.webp",
  });

  assert.equal(image.source, "EXTERNAL_URL");
  assert.deepEqual(deps.calls.external, [
    { productId: "product-1", url: "https://images.example.com/ball.webp" },
  ]);
});

test("verified Place owner upload uses validated storage and normalized image processor", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { hasVerifiedOwnership: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
  );

  const image = await service.addUpload("owner-1", "place-1", "product-1", {
    contentType: "image/jpeg",
    body: new Uint8Array([9, 8, 7]),
  });

  assert.equal(image.source, "UPLOAD");
  assert.equal(deps.calls.prepare.length, 1);
  assert.equal(deps.calls.upload.length, 1);
  assert.equal(deps.calls.upload[0].contentType, "image/webp");
  assert.equal(deps.calls.upload[0].sizeBytes, 3);
});

test("product image reorder stays within the selected product and shop", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { hasVerifiedOwnership: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
  );

  await service.reorder("owner-1", "place-1", "product-1", {
    imageIds: ["image-3", "image-1", "image-2"],
  });
  assert.deepEqual(deps.calls.reorder, [
    { productId: "product-1", imageIds: ["image-3", "image-1", "image-2"] },
  ]);
});

test("only App Admin can change the product image limit", async () => {
  const [, { GearUpSettingsService }] = await loadServices();
  const deps = dependencies();
  const service = new GearUpSettingsService(deps.images, deps.platformAdmin);

  assert.deepEqual(await service.get(), { productImageLimit: 3 });
  assert.deepEqual(await service.update("admin-1", { productImageLimit: 5 }), {
    productImageLimit: 5,
  });
  assert.equal(deps.calls.adminChecks, 1);
  assert.deepEqual(deps.calls.settings, [
    { userId: "admin-1", input: { productImageLimit: 5 } },
  ]);
});
