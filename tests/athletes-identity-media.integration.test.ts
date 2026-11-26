import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";

const db = getDatabaseClient();

test("Athletes identity supports independent managed logo and banner without losing legacy URLs", async () => {
  const user = await db.user.create({ data: {} });
  const repository = new PrismaAthletesRepository(db);
  try {
    const community = await repository.createWithFounder(user.id, {
      name: `Identity ${randomUUID()}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      logoUrl: "https://example.org/logo.png",
      bannerUrl: "https://example.org/banner.png",
    });
    const rows = await db.$queryRaw<
      Array<{ logoMediaId: string | null; bannerMediaId: string | null }>
    >`
      SELECT "logoMediaId", "bannerMediaId" FROM "AthletesCommunity" WHERE "id" = ${community.id}
    `;
    assert.deepEqual(rows, [{ logoMediaId: null, bannerMediaId: null }]);
    const detail = await repository.getPublic(community.id);
    assert.equal(detail?.logoUrl, "https://example.org/logo.png");
    assert.equal(detail?.bannerUrl, "https://example.org/banner.png");
    assert.equal(detail?.logoMediaPath, null);
    assert.equal(detail?.bannerMediaPath, null);
  } finally {
    await db.athletesCommunity.deleteMany({ where: { createdByUserId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

test("Athletes external logo URL can coexist with managed logo without changing banner", async () => {
  const user = await db.user.create({ data: {} });
  const repository = new PrismaAthletesRepository(db);
  try {
    const community = await repository.createWithFounder(user.id, {
      name: `Identity replacement ${randomUUID()}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
    });
    const logoMediaId = randomUUID();
    const bannerMediaId = randomUUID();
    const logoObjectKey = `staging/media/v1/athletes-community-logo/${community.id}/${logoMediaId}/master.webp`;
    const bannerObjectKey = `staging/media/v1/athletes-community-banner/${community.id}/${bannerMediaId}/master.webp`;
    await db.athletesCommunity.update({
      where: { id: community.id },
      data: {
        logoMediaId,
        logoObjectKey,
        logoContentType: "image/webp",
        logoSizeBytes: 4,
        bannerMediaId,
        bannerObjectKey,
        bannerContentType: "image/webp",
        bannerSizeBytes: 4,
      },
    });
    await repository.withCommunityLock(community.id, (locked) =>
      locked.update(community.id, { logoUrl: "https://example.org/new.png" }),
    );
    const current = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: community.id },
    });
    assert.equal(current.logoUrl, "https://example.org/new.png");
    assert.equal(current.logoMediaId, logoMediaId);
    assert.equal(current.logoObjectKey, logoObjectKey);
    assert.equal(current.logoContentType, "image/webp");
    assert.equal(current.logoSizeBytes, 4);
    assert.equal(current.bannerMediaId, bannerMediaId);
    assert.equal(current.bannerObjectKey, bannerObjectKey);
    assert.equal(await db.outboxEvent.count({ where: { id: logoMediaId } }), 0);
    assert.equal(await db.outboxEvent.count({ where: { id: bannerMediaId } }), 0);

    const publicDetail = await repository.getPublic(community.id);
    assert.equal(publicDetail?.logoUrl, null);
    assert.equal(
      publicDetail?.logoMediaPath,
      `/api/public/v1/athletes/${encodeURIComponent(community.id)}/identity/logo/content`,
    );
    assert.equal(
      publicDetail?.bannerMediaPath,
      `/api/public/v1/athletes/${encodeURIComponent(community.id)}/identity/banner/content`,
    );
    assert.equal(JSON.stringify(publicDetail).includes(logoObjectKey), false);
    assert.equal(JSON.stringify(publicDetail).includes(bannerObjectKey), false);
  } finally {
    const communities = await db.athletesCommunity.findMany({
      where: { createdByUserId: user.id },
      select: { id: true },
    });
    await db.outboxEvent.deleteMany({
      where: { aggregateId: { in: communities.map((community) => community.id) } },
    });
    await db.athletesCommunity.deleteMany({ where: { createdByUserId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
