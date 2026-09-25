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

test("Gear Up product catalog keeps archived products private but manageable", async () => {
  const { PrismaGearUpProductRepository } = await loadRepository();
  const repository = new PrismaGearUpProductRepository(db);
  const suffix = Date.now().toString(36);
  const user = await db.user.create({ data: {} });
  const place = await db.place.create({
    data: {
      slug: `gear-up-products-${suffix}`,
      name: `Gear Up Products ${suffix}`,
      address: `20 Catalog Street ${suffix}`,
      moderationStatus: "APPROVED",
      submissionOrigin: "OWNER",
      suggestedByUserId: user.id,
      discoveries: { create: { kind: "GEAR_UP" } },
      gearUpShop: {
        create: {
          moderationStatus: "APPROVED",
          offerTypes: ["GEAR"],
          sports: ["FOOTBALL"],
          categories: ["BALLS"],
        },
      },
    },
  });

  try {
    const created = await repository.create(place.id, {
      title: "Match Ball",
      brand: null,
      description: "A football for matches and training.",
      sports: ["FOOTBALL"],
      category: "BALLS",
      price: null,
      currency: "TND",
    });
    assert.equal(created.price, null);
    assert.equal(created.archivedAt, null);
    assert.equal(created.coverImageId, null);

    const laterImage = await db.gearUpProductImage.create({
      data: {
        productId: created.id,
        source: "EXTERNAL_URL",
        externalUrl: "https://images.example.com/later.webp",
        sortOrder: 1,
      },
    });
    const coverImage = await db.gearUpProductImage.create({
      data: {
        productId: created.id,
        source: "EXTERNAL_URL",
        externalUrl: "https://images.example.com/cover.webp",
        sortOrder: 0,
      },
    });

    const publicProduct = (await repository.listPublicByShop(place.id)).find(
      (item) => item.id === created.id,
    );
    assert.equal(publicProduct?.coverImageId, coverImage.id);
    assert.notEqual(publicProduct?.coverImageId, laterImage.id);

    const featured = await repository.feature(created.id);
    const featuredAgain = await repository.feature(created.id);
    assert.equal(featured.featuredAt, featuredAgain.featuredAt);

    const unfeatured = await repository.unfeature(created.id);
    const unfeaturedAgain = await repository.unfeature(created.id);
    assert.equal(unfeatured.featuredAt, null);
    assert.equal(unfeaturedAgain.featuredAt, null);

    const priced = await repository.update(created.id, { price: 149.9 });
    assert.equal(priced.price, 149.9);

    const archived = await repository.archive(created.id);
    assert.notEqual(archived.archivedAt, null);
    assert.equal(
      (await repository.listPublicByShop(place.id)).some((item) => item.id === created.id),
      false,
    );
    assert.equal(
      (await repository.listManagedByShop(place.id)).some(
        (item) => item.id === created.id && item.archivedAt !== null,
      ),
      true,
    );

    const restored = await repository.restore(created.id);
    assert.equal(restored.archivedAt, null);
    assert.equal(
      (await repository.listPublicByShop(place.id)).some((item) => item.id === created.id),
      true,
    );
  } finally {
    await db.place.delete({ where: { id: place.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
