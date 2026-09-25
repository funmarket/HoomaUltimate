import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const serviceUrl = new URL(
  "../apps/api/src/modules/gear-up/application/gear-up.service.ts",
  import.meta.url,
);

async function loadService() {
  assert.equal(existsSync(serviceUrl), true, "Gear Up service must exist");
  return import(serviceUrl.href);
}

function suggestionInput() {
  return {
    place: {
      name: "Tunis Football Store",
      address: "10 Sports Street",
      submissionOrigin: "FANHUB",
      imageUrls: [],
      menuItems: [],
    },
    shop: {
      offerTypes: ["SPORTSWEAR", "GEAR"],
      sports: ["FOOTBALL"],
      categories: ["JERSEYS_KITS", "BALLS"],
    },
  };
}

function dependencies(overrides = {}) {
  const calls = {
    suggestions: [],
    reviews: [],
    adminChecks: 0,
  };
  const repository = {
    listPublic: async () => [],
    getPublic: async () => null,
    suggest: async (userId, input) => {
      calls.suggestions.push({ userId, input });
      return { outcome: "CREATED", place: { id: "place-1" }, status: "PENDING" };
    },
    getManaged: async () => ({ placeId: "place-1" }),
    updateShop: async () => ({ placeId: "place-1" }),
    pending: async () => [{ placeId: "place-1" }],
    review: async (actorUserId, placeId, input) => {
      calls.reviews.push({ actorUserId, placeId, input });
      return true;
    },
    ...overrides.repository,
  };
  const places = {
    canManage: async () => false,
    ...overrides.places,
  };
  const platformAdmin = {
    isPlatformAdmin: async () => false,
    requirePlatformAdmin: async () => {
      calls.adminChecks += 1;
    },
    ...overrides.platformAdmin,
  };
  const imageResolver = {
    resolve: async (value) => value,
  };
  return { calls, repository, places, platformAdmin, imageResolver };
}

test("Gear Up suggestion preserves canonical Place input and shop classification", async () => {
  const { GearUpService } = await loadService();
  const deps = dependencies();
  const service = new GearUpService(
    deps.repository,
    deps.places,
    deps.platformAdmin,
    deps.imageResolver,
  );

  await service.suggest("fan-1", suggestionInput());

  assert.equal(deps.calls.suggestions.length, 1);
  assert.equal(deps.calls.suggestions[0].userId, "fan-1");
  assert.equal(deps.calls.suggestions[0].input.place.submissionOrigin, "FANHUB");
  assert.deepEqual(deps.calls.suggestions[0].input.shop.offerTypes, ["SPORTSWEAR", "GEAR"]);
});

test("pending original Place manager can manage Gear Up shop while unrelated member cannot", async () => {
  const { GearUpService } = await loadService();
  const allowed = dependencies({ places: { canManage: async () => true } });
  const allowedService = new GearUpService(
    allowed.repository,
    allowed.places,
    allowed.platformAdmin,
    allowed.imageResolver,
  );

  assert.deepEqual(await allowedService.getManaged("submitter-1", "place-1"), {
    placeId: "place-1",
  });

  const forbidden = dependencies();
  const forbiddenService = new GearUpService(
    forbidden.repository,
    forbidden.places,
    forbidden.platformAdmin,
    forbidden.imageResolver,
  );

  await assert.rejects(
    () => forbiddenService.getManaged("member-1", "place-1"),
    (error) => error?.code === "GEAR_UP_MANAGE_FORBIDDEN",
  );
});

test("App Admin owns Gear Up moderation and stale decisions are rejected", async () => {
  const { GearUpService } = await loadService();
  const deps = dependencies();
  const service = new GearUpService(
    deps.repository,
    deps.places,
    deps.platformAdmin,
    deps.imageResolver,
  );

  assert.deepEqual(await service.pending("admin-1"), [{ placeId: "place-1" }]);
  assert.equal(deps.calls.adminChecks, 1);

  assert.deepEqual(
    await service.review("admin-1", "place-1", { decision: "APPROVE", note: "Approved" }),
    { ok: true },
  );
  assert.equal(deps.calls.adminChecks, 2);
  assert.deepEqual(deps.calls.reviews, [
    {
      actorUserId: "admin-1",
      placeId: "place-1",
      input: { decision: "APPROVE", note: "Approved" },
    },
  ]);

  const stale = dependencies({ repository: { review: async () => false } });
  const staleService = new GearUpService(
    stale.repository,
    stale.places,
    stale.platformAdmin,
    stale.imageResolver,
  );
  await assert.rejects(
    () => staleService.review("admin-1", "place-1", { decision: "APPROVE" }),
    (error) => error?.code === "GEAR_UP_REVIEW_NOT_PENDING",
  );
});
