import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("Request surface eligibility is applied before cursor pagination", async () => {
  const repository = new PrismaRequestRepository(db);
  const user = await db.user.create({ data: {} });
  const suffix = user.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const subcategoryId = `test-rq2b-sub-${suffix}`;
  const requestsNeedId = `test-rq2b-requests-${suffix}`;
  const playNeedId = `test-rq2b-play-${suffix}`;

  await db.helpTaxonomySubcategory.create({
    data: {
      id: subcategoryId,
      requestType: "SPORT",
      sport: "OTHER",
      slug: `rq2b-${suffix}`,
      label: "RQ2B Test",
      sortOrder: 999,
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: requestsNeedId,
      subcategoryId,
      slug: `requests-${suffix}`,
      label: "Requests only",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 10,
      surfaces: { create: [{ surface: "REQUESTS" }] },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: playNeedId,
      subcategoryId,
      slug: `play-${suffix}`,
      label: "Play only",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 20,
      surfaces: { create: [{ surface: "PLAY" }] },
    },
  });

  try {
    const play = await db.helpRequest.create({
      data: {
        createdByUserId: user.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: playNeedId,
        title: "Older Play request",
        description: "This request is eligible for the Play projection only.",
        createdAt: new Date("2026-09-22T00:00:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: user.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Newer Requests request",
        description: "This newer request must not consume the Play page limit.",
        createdAt: new Date("2026-09-22T00:01:00.000Z"),
      },
    });

    const page = await repository.listPublic({ surface: "PLAY", limit: 1 });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.id, play.id);
    assert.equal(page.nextCursor, null);
  } finally {
    await db.helpRequest.deleteMany({ where: { createdByUserId: user.id } });
    await db.helpTaxonomyNeed.deleteMany({ where: { subcategoryId } });
    await db.helpTaxonomySubcategory.delete({ where: { id: subcategoryId } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
