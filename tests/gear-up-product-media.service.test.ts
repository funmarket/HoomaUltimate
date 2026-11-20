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
    canManage: async () => false,
    isVerifiedOwner: async () => false,
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
      profile: "PHOTO_STANDARD",
      selectedVariants: ["master"],
      source: { contentType: "image/jpeg", widthPx: 2, heightPx: 2 },
      variants: [{
        variant: "master", body: new Uint8Array([1, 2, 3]),
        contentType: "image/webp", sizeBytes: 3, widthPx: 2, heightPx: 2,
      }],
    }),
  };
  return { calls, images, products, places, platformAdmin, storage, processor };
}

test("pending submitter access cannot manage official product media", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { isVerifiedOwner: async () => false },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
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
    places: { isVerifiedOwner: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
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
    places: { isVerifiedOwner: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
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
    places: { isVerifiedOwner: async () => true },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
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
  assert.deepEqual(deps.calls.settings, [{ userId: "admin-1", input: { productImageLimit: 5 } }]);
});

test("Step 22 writes only the exact planned scoped Gear Up master key", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const writes = [];
  const deps = dependencies({
    places: { isVerifiedOwner: async () => true },
    storage: {
      put: async (key, body, contentType) => {
        writes.push({ key, contentType, bytes: body.byteLength });
        return { key, contentType, sizeBytes: body.byteLength };
      },
      remove: async () => {
        throw new Error("must keep reconciliation intent");
      },
    },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
  );
  await service.addUpload("owner-1", "place-1", "product-1", {
    contentType: "image/jpeg",
    body: new Uint8Array([9, 8, 7]),
  });
  assert.equal(writes.length, 1);
  const key = writes[0].key;
  assert.match(key, /^staging\/media\/v1\/gear-up-product\/product-1\/[a-f0-9-]+\/master\.webp$/);
  assert.equal(deps.calls.prepare[0].objectKey, key);
  assert.equal(deps.calls.upload[0].objectKey, key);
  assert.equal(deps.calls.upload[0].contentType, "image/webp");
});

test("Step 22 rejects invalid variant sets without writing or preparing intent", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { isVerifiedOwner: async () => true },
    processor: {
      process: async () => ({
        profile: "PHOTO_STANDARD",
        selectedVariants: ["master", "card"],
        variants: [],
      }),
    },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
  );
  await assert.rejects(
    () =>
      service.addUpload("owner-1", "place-1", "product-1", {
        contentType: "image/jpeg",
        body: new Uint8Array([1]),
      }),
    (error) => error?.code === "GEAR_UP_PRODUCT_IMAGE_UPLOAD_FAILED",
  );
  assert.equal(deps.calls.prepare.length, 0);
  assert.equal(deps.calls.upload.length, 0);
});

test("Step 22 retains planned intent after a storage-returned key mismatch", async () => {
  const [{ GearUpProductMediaService }] = await loadServices();
  const deps = dependencies({
    places: { isVerifiedOwner: async () => true },
    storage: {
      put: async (key, body, contentType) => ({
        key: `${key}-other`,
        contentType,
        sizeBytes: body.byteLength,
      }),
      remove: async () => {
        throw new Error("synchronous cleanup must not run");
      },
    },
  });
  const service = new GearUpProductMediaService(
    deps.images,
    deps.products,
    deps.places,
    deps.platformAdmin,
    deps.storage,
    deps.processor,
    "staging",
  );
  await assert.rejects(
    () =>
      service.addUpload("owner-1", "place-1", "product-1", {
        contentType: "image/jpeg",
        body: Uint8Array.of(1, 2, 3),
      }),
    (error) => error?.code === "GEAR_UP_PRODUCT_IMAGE_UPLOAD_FAILED",
  );
  assert.equal(deps.calls.prepare.length, 1);
  assert.equal(deps.calls.upload.length, 0);
});
