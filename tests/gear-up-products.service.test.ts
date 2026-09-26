import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const serviceUrl = new URL(
  "../apps/api/src/modules/gear-up/application/gear-up-product.service.ts",
  import.meta.url,
);

async function loadService() {
  assert.equal(existsSync(serviceUrl), true, "Gear Up product service must exist");
  return import(serviceUrl.href);
}

function productInput() {
  return {
    title: "Match Ball",
    brand: "HOOMA Sports",
    description: "Training and match football.",
    sports: ["FOOTBALL"],
    category: "BALLS",
    price: null,
    currency: "TND",
  };
}

function dependencies(overrides = {}) {
  const calls = {
    create: [],
    feature: [],
    unfeature: [],
    archive: [],
    restore: [],
  };
  const repository = {
    listPublic: async () => ({ items: [], nextCursor: null }),
    listPublicByShop: async () => [],
    getPublic: async () => null,
    listManagedByShop: async () => [],
    getManaged: async () => ({ id: "product-1", shopPlaceId: "place-1" }),
    create: async (placeId, input) => {
      calls.create.push({ placeId, input });
      return { id: "product-1", shopPlaceId: placeId, ...input };
    },
    update: async () => ({ id: "product-1" }),
    feature: async (productId) => {
      calls.feature.push(productId);
      return { id: productId, featuredAt: "2026-09-25T00:00:00.000Z" };
    },
    unfeature: async (productId) => {
      calls.unfeature.push(productId);
      return { id: productId, featuredAt: null };
    },
    archive: async (productId) => {
      calls.archive.push(productId);
      return { id: productId, archivedAt: "2026-09-25T00:00:00.000Z" };
    },
    restore: async (productId) => {
      calls.restore.push(productId);
      return { id: productId, archivedAt: null };
    },
    ...overrides.repository,
  };
  const places = {
    hasVerifiedOwnership: async () => false,
    canManage: async () => false,
    ...overrides.places,
  };
  const platformAdmin = {
    isPlatformAdmin: async () => false,
    ...overrides.platformAdmin,
  };
  return { calls, repository, places, platformAdmin };
}

test("public product discovery forwards one server-side query to the repository", async () => {
  const { GearUpProductService } = await loadService();
  const calls = [];
  const deps = dependencies({
    repository: {
      listPublic: async (input) => {
        calls.push(input);
        return { items: [], nextCursor: null };
      },
    },
  });
  const service = new GearUpProductService(deps.repository, deps.places, deps.platformAdmin);

  const result = await service.listPublic({
    q: "boots",
    sport: "FOOTBALL",
    featured: true,
    limit: 24,
  });

  assert.deepEqual(result, { items: [], nextCursor: null });
  assert.deepEqual(calls, [{ q: "boots", sport: "FOOTBALL", featured: true, limit: 24 }]);
});

test("FanHub and pending owner-submitters cannot publish official Gear Up products", async () => {
  const { GearUpProductService } = await loadService();
  const deps = dependencies({
    places: {
      hasVerifiedOwnership: async () => false,
      canManage: async () => true,
    },
  });
  const service = new GearUpProductService(deps.repository, deps.places, deps.platformAdmin);

  await assert.rejects(
    () => service.create("pending-owner", "place-1", productInput()),
    (error) => error?.code === "GEAR_UP_PRODUCT_MANAGE_FORBIDDEN",
  );
  assert.equal(deps.calls.create.length, 0);
});

test("verified Place owner can create and manage Gear Up products", async () => {
  const { GearUpProductService } = await loadService();
  const deps = dependencies({
    places: { hasVerifiedOwnership: async () => true },
  });
  const service = new GearUpProductService(deps.repository, deps.places, deps.platformAdmin);

  const created = await service.create("owner-1", "place-1", productInput());
  assert.equal(created.id, "product-1");
  assert.equal(deps.calls.create.length, 1);

  await service.feature("owner-1", "place-1", "product-1");
  await service.unfeature("owner-1", "place-1", "product-1");
  await service.archive("owner-1", "place-1", "product-1");
  await service.restore("owner-1", "place-1", "product-1");

  assert.deepEqual(deps.calls.feature, ["product-1"]);
  assert.deepEqual(deps.calls.unfeature, ["product-1"]);
  assert.deepEqual(deps.calls.archive, ["product-1"]);
  assert.deepEqual(deps.calls.restore, ["product-1"]);
});

test("App Admin can manage official Gear Up products without Place ownership", async () => {
  const { GearUpProductService } = await loadService();
  const deps = dependencies({
    platformAdmin: { isPlatformAdmin: async () => true },
  });
  const service = new GearUpProductService(deps.repository, deps.places, deps.platformAdmin);

  const created = await service.create("admin-1", "place-1", productInput());
  assert.equal(created.id, "product-1");
  assert.equal(deps.calls.create.length, 1);
});
