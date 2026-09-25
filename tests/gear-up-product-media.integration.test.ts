import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const repositoryUrl = new URL(
  "../apps/api/src/modules/gear-up/infrastructure/prisma-gear-up-product-media.repository.ts",
  import.meta.url,
);

const db = getDatabaseClient();

async function loadRepository() {
  assert.equal(existsSync(repositoryUrl), true, "Gear Up product media repository must exist");
  return import(repositoryUrl.href);
}

test("Gear Up product media enforces the configured limit and preserves ordering", async () => {
  const { PrismaGearUpProductMediaRepository } = await loadRepository();
  const repository = new PrismaGearUpProductMediaRepository(db);
  const suffix = Date.now().toString(36);
  const user = await db.user.create({ data: {} });
  const place = await db.place.create({
    data: {
      slug: `gear-up-media-${suffix}`,
      name: `Gear Up Media ${suffix}`,
      address: `30 Media Street ${suffix}`,
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
          products: {
            create: {
              title: "Training Ball",
              description: "Football for training.",
              sports: ["FOOTBALL"],
              category: "BALLS",
              currency: "TND",
            },
          },
        },
      },
    },
    include: { gearUpShop: { include: { products: true } } },
  });
  const productId = place.gearUpShop!.products[0]!.id;

  try {
    await repository.updateSettings(user.id, { productImageLimit: 3 });
    assert.deepEqual(await repository.getSettings(), { productImageLimit: 3 });

    const first = await repository.addExternalUrl(
      productId,
      "https://images.example.com/one.webp",
    );
    const second = await repository.addExternalUrl(
      productId,
      "https://images.example.com/two.webp",
    );
    const third = await repository.addExternalUrl(
      productId,
      "https://images.example.com/three.webp",
    );
    assert.deepEqual(
      (await repository.list(productId)).map((image) => image.sortOrder),
      [0, 1, 2],
    );

    await assert.rejects(
      () => repository.addExternalUrl(productId, "https://images.example.com/four.webp"),
      (error) => error?.code === "GEAR_UP_PRODUCT_IMAGE_LIMIT_REACHED",
    );

    await repository.reorder(productId, [third.id, first.id, second.id]);
    assert.deepEqual(
      (await repository.list(productId)).map((image) => image.id),
      [third.id, first.id, second.id],
    );

    await repository.delete(productId, first.id);
    assert.deepEqual(
      (await repository.list(productId)).map((image) => image.sortOrder),
      [0, 1],
    );

    const replacement = await repository.addExternalUrl(
      productId,
      "https://images.example.com/replacement.webp",
    );
    assert.equal(replacement.sortOrder, 2);

    await repository.updateSettings(user.id, { productImageLimit: 4 });
    const fourth = await repository.addExternalUrl(
      productId,
      "https://images.example.com/four.webp",
    );
    assert.equal(fourth.sortOrder, 3);

    for (const image of await repository.list(productId)) {
      await repository.delete(productId, image.id);
    }
    await repository.updateSettings(user.id, { productImageLimit: 3 });

    const concurrent = await Promise.allSettled(
      ["a", "b", "c", "d"].map((name) =>
        repository.addExternalUrl(productId, `https://images.example.com/${name}.webp`),
      ),
    );
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 3);
    assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await repository.list(productId)).length, 3);
  } finally {
    await db.place.delete({ where: { id: place.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
