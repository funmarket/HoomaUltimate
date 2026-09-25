import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";

const repositoryUrl = new URL(
  "../apps/api/src/modules/gear-up/infrastructure/prisma-gear-up.repository.ts",
  import.meta.url,
);

const db = getDatabaseClient();

async function loadRepository() {
  assert.equal(existsSync(repositoryUrl), true, "Gear Up Prisma repository must exist");
  return import(repositoryUrl.href);
}

function input(name: string, address: string) {
  return {
    place: {
      name,
      address,
      city: "Tunis",
      houma: "Centre",
      latitude: null,
      longitude: null,
      phone: null,
      websiteUrl: null,
      imageUrl: null,
      imageUrls: [],
      description: "Local sports shop",
      category: null,
      email: null,
      menuItems: [],
      submissionOrigin: "FANHUB",
    },
    shop: {
      offerTypes: ["SPORTSWEAR", "GEAR"],
      sports: ["FOOTBALL"],
      categories: ["JERSEYS_KITS", "BALLS"],
      paymentMethods: [],
    },
  };
}

test("Gear Up repository reuses canonical Place and approves Place plus shop atomically", async () => {
  const { PrismaGearUpRepository } = await loadRepository();
  const repository = new PrismaGearUpRepository(db);
  const suffix = Date.now().toString(36);
  const submitter = await db.user.create({ data: {} });
  const admin = await db.user.create({ data: {} });

  try {
    const first = await repository.suggest(
      submitter.id,
      input(`Gear Up Store ${suffix}`, `10 Gear Street ${suffix}`),
    );
    assert.equal(first.outcome, "CREATED");
    assert.equal(first.status, "PENDING");

    const placeId = first.place.id;
    assert.equal(await db.placeDiscovery.count({ where: { placeId, kind: "GEAR_UP" } }), 1);
    assert.equal(await db.gearUpShop.count({ where: { placeId } }), 1);
    const genericPlaces = new PrismaPlaceRepository(db);
    assert.equal(
      (await genericPlaces.pendingPlaces()).some((item) => item.place.id === placeId),
      false,
      "Initial Gear Up submissions must not also enter the generic Place review queue",
    );

    const duplicate = await repository.suggest(
      submitter.id,
      input(`Gear Up Store ${suffix}`, `10 Gear Street ${suffix}`),
    );
    assert.equal(duplicate.outcome, "EXISTING");
    assert.equal(duplicate.place.id, placeId);
    assert.equal(
      await db.place.count({
        where: { name: `Gear Up Store ${suffix}`, address: `10 Gear Street ${suffix}` },
      }),
      1,
    );
    assert.equal(await db.gearUpShop.count({ where: { placeId } }), 1);

    assert.equal(
      (await repository.listPublic({})).some((item) => item.place.id === placeId),
      false,
    );

    assert.equal(
      await repository.review(admin.id, placeId, {
        decision: "APPROVE",
        note: "Gear Up listing approved",
      }),
      true,
    );

    const approvedPlace = await db.place.findUniqueOrThrow({
      where: { id: placeId },
      select: { moderationStatus: true },
    });
    const approvedShop = await db.gearUpShop.findUniqueOrThrow({
      where: { placeId },
      select: { moderationStatus: true },
    });
    assert.equal(approvedPlace.moderationStatus, "APPROVED");
    assert.equal(approvedShop.moderationStatus, "APPROVED");
    assert.equal(
      (await repository.listPublic({ offer: "GEAR" })).some((item) => item.place.id === placeId),
      true,
    );

    const updated = await repository.updateShop(placeId, {
      paymentMethods: ["CASH", "CRYPTO"],
    });
    assert.deepEqual(updated?.paymentMethods, ["CASH", "CRYPTO"]);
    assert.deepEqual((await repository.getPublic(placeId))?.paymentMethods, ["CASH", "CRYPTO"]);
  } finally {
    await db.place.deleteMany({ where: { suggestedByUserId: submitter.id } });
    await db.user.deleteMany({ where: { id: { in: [submitter.id, admin.id] } } });
  }
});
