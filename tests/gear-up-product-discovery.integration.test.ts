import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const repositoryUrl = new URL(
  "../apps/api/src/modules/gear-up/infrastructure/prisma-gear-up-product.repository.ts",
  import.meta.url,
);

const db = getDatabaseClient();

async function loadRepository() {
  assert.equal(existsSync(repositoryUrl), true, "Gear Up product Prisma repository must exist");
  return import(repositoryUrl.href);
}

test("cross-store product discovery filters approved canonical shops and paginates directly", async () => {
  const { PrismaGearUpProductRepository } = await loadRepository();
  const repository = new PrismaGearUpProductRepository(db);
  const suffix = Date.now().toString(36);
  const user = await db.user.create({ data: {} });

  const shopOne = await db.place.create({
    data: {
      slug: `gear-up-discovery-one-${suffix}`,
      name: `Boot House ${suffix}`,
      address: `1 Discovery Street ${suffix}`,
      city: "Tunis",
      houma: "La Marsa",
      moderationStatus: "APPROVED",
      submissionOrigin: "OWNER",
      suggestedByUserId: user.id,
      discoveries: { create: { kind: "GEAR_UP" } },
      gearUpShop: {
        create: {
          moderationStatus: "APPROVED",
          offerTypes: ["SPORTSWEAR", "GEAR"],
          sports: ["FOOTBALL"],
          categories: ["FOOTWEAR_BOOTS", "BALLS"],
        },
      },
    },
  });

  const shopTwo = await db.place.create({
    data: {
      slug: `gear-up-discovery-two-${suffix}`,
      name: `Runner Store ${suffix}`,
      address: `2 Discovery Street ${suffix}`,
      city: "Sfax",
      houma: "Centre",
      moderationStatus: "APPROVED",
      submissionOrigin: "FANHUB",
      suggestedByUserId: user.id,
      discoveries: { create: { kind: "GEAR_UP" } },
      gearUpShop: {
        create: {
          moderationStatus: "APPROVED",
          offerTypes: ["SPORTSWEAR"],
          sports: ["RUNNING"],
          categories: ["FOOTWEAR_BOOTS"],
        },
      },
    },
  });

  const hiddenShop = await db.place.create({
    data: {
      slug: `gear-up-discovery-hidden-${suffix}`,
      name: `Pending Store ${suffix}`,
      address: `3 Discovery Street ${suffix}`,
      city: "Tunis",
      moderationStatus: "PENDING",
      submissionOrigin: "OWNER",
      suggestedByUserId: user.id,
      discoveries: { create: { kind: "GEAR_UP" } },
      gearUpShop: {
        create: {
          moderationStatus: "PENDING",
          offerTypes: ["GEAR"],
          sports: ["FOOTBALL"],
          categories: ["BALLS"],
        },
      },
    },
  });

  try {
    const boots = await repository.create(shopOne.id, {
      title: "Control Football Boots",
      brand: "HOOMA Test",
      description: "Football boots for firm ground.",
      sports: ["FOOTBALL"],
      category: "FOOTWEAR_BOOTS",
      price: 249,
      currency: "TND",
    });
    await repository.feature(boots.id);

    const ball = await repository.create(shopOne.id, {
      title: "Training Ball",
      brand: null,
      description: "Everyday football training ball.",
      sports: ["FOOTBALL"],
      category: "BALLS",
      price: null,
      currency: "TND",
    });

    const running = await repository.create(shopTwo.id, {
      title: "Running Shoes",
      brand: "HOOMA Test",
      description: "Road running footwear.",
      sports: ["RUNNING"],
      category: "FOOTWEAR_BOOTS",
      price: 199,
      currency: "TND",
    });

    await repository.create(hiddenShop.id, {
      title: "Hidden Ball",
      brand: null,
      description: "Must not appear publicly.",
      sports: ["FOOTBALL"],
      category: "BALLS",
      price: null,
      currency: "TND",
    });

    const tunisFootball = await repository.listPublic({
      sport: "FOOTBALL",
      city: "Tunis",
      limit: 10,
    });
    assert.deepEqual(tunisFootball.items.map((item) => item.id).sort(), [boots.id, ball.id].sort());
    assert.equal(
      tunisFootball.items.every((item) => item.shop.placeId === shopOne.id),
      true,
    );

    const featured = await repository.listPublic({ featured: true, limit: 10 });
    assert.deepEqual(
      featured.items.map((item) => item.id),
      [boots.id],
    );

    const gear = await repository.listPublic({ offer: "GEAR", limit: 10 });
    assert.equal(
      gear.items.some((item) => item.id === ball.id),
      true,
    );
    assert.equal(
      gear.items.some((item) => item.id === running.id),
      false,
    );

    const firstPage = await repository.listPublic({ limit: 1 });
    assert.equal(firstPage.items.length, 1);
    assert.notEqual(firstPage.nextCursor, null);
    const secondPage = await repository.listPublic({
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
    });
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(secondPage.items[0]?.id, firstPage.items[0]?.id);

    const searched = await repository.listPublic({ q: `Boot House ${suffix}`, limit: 10 });
    assert.equal(
      searched.items.some((item) => item.id === boots.id),
      true,
    );
  } finally {
    await db.place.deleteMany({ where: { id: { in: [shopOne.id, shopTwo.id, hiddenShop.id] } } });
    await db.user.delete({ where: { id: user.id } });
  }
});
