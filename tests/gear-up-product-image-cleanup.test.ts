import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const cleanupUrl = new URL(
  "../apps/worker/src/gear-up/gear-up-product-image-cleanup.ts",
  import.meta.url,
);

async function loadCleanup() {
  assert.equal(existsSync(cleanupUrl), true, "Gear Up product image cleanup handler must exist");
  return import(cleanupUrl.href);
}

test("Gear Up product image cleanup removes only unreferenced owned objects", async () => {
  const { createGearUpProductImageCleanupHandler } = await loadCleanup();
  const removed = [];
  const storage = {
    remove: async (key) => {
      removed.push(key);
    },
  };
  let referenced = false;
  const database = {
    gearUpProductImage: {
      findFirst: async () => (referenced ? { id: "image-1" } : null),
    },
  };
  const handler = createGearUpProductImageCleanupHandler(database, storage);

  await handler({
    id: "event-1",
    topic: "gear-up.product-image.reconcile-object",
    payload: {
      productId: "product-1",
      objectKey: "gear-up-product-images/product-1/image-1",
    },
  });
  assert.deepEqual(removed, ["gear-up-product-images/product-1/image-1"]);

  referenced = true;
  await handler({
    id: "event-2",
    topic: "gear-up.product-image.reconcile-object",
    payload: {
      productId: "product-1",
      objectKey: "gear-up-product-images/product-1/image-2",
    },
  });
  assert.deepEqual(removed, ["gear-up-product-images/product-1/image-1"]);
});

test("Gear Up product image cleanup rejects keys outside product ownership boundary", async () => {
  const { createGearUpProductImageCleanupHandler } = await loadCleanup();
  const handler = createGearUpProductImageCleanupHandler(
    {
      gearUpProductImage: {
        findFirst: async () => null,
      },
    },
    { remove: async () => undefined },
  );

  await assert.rejects(
    () =>
      handler({
        id: "event-3",
        topic: "gear-up.product-image.reconcile-object",
        payload: {
          productId: "product-1",
          objectKey: "request-images/request-1/not-owned",
        },
      }),
    /outside the Gear Up product ownership boundary/,
  );
});
