import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("Request search is safe, case-insensitive and composed before filters and pagination", async () => {
  const repository = new PrismaRequestRepository(db);
  const owner = await db.user.create({ data: {} });
  const responder = await db.user.create({ data: {} });
  const suffix = owner.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const subcategoryId = `test-r1-sub-${suffix}`;
  const requestsNeedId = `test-r1-requests-${suffix}`;
  const playNeedId = `test-r1-play-${suffix}`;
  const communityId = `test-r1-community-${suffix}`;

  await db.community.create({
    data: {
      id: communityId,
      slug: `test-r1-${suffix}`,
      name: "R1 Search Private Community",
      createdByUserId: owner.id,
    },
  });
  await db.helpTaxonomySubcategory.create({
    data: {
      id: subcategoryId,
      requestType: "SPORT",
      sport: "OTHER",
      slug: `r1-${suffix}`,
      label: "R1 Search Test",
      sortOrder: 999,
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: requestsNeedId,
      subcategoryId,
      slug: `requests-${suffix}`,
      label: "Requests search",
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
      label: "Play search",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 20,
      surfaces: { create: [{ surface: "PLAY" }] },
    },
  });

  try {
    const titleMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Need GOALKEEPER gloves",
        description: "Looking for safe training equipment nearby.",
        createdAt: new Date("2026-09-22T00:01:00.000Z"),
      },
    });
    const descriptionMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Training support needed",
        description: "A young sweeperkeeper needs practice cones.",
        createdAt: new Date("2026-09-22T00:02:00.000Z"),
      },
    });
    const customNeedMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        customNeed: "Goalkeeper jersey set",
        title: "Specific kit request",
        description: "Looking for a custom item for training.",
        createdAt: new Date("2026-09-22T00:03:00.000Z"),
      },
    });
    const playMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: playNeedId,
        title: "Goalkeeper warmup help",
        description: "This request belongs to Play only.",
        createdAt: new Date("2026-09-22T00:04:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Newest unrelated request",
        description: "This newer row must not consume a search page limit.",
        createdAt: new Date("2026-09-22T00:05:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "HOOMA_COMMUNITY",
        audienceCommunityId: communityId,
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Hidden goalkeeper request",
        description: "Private community content must not leak into public search.",
        createdAt: new Date("2026-09-22T00:06:00.000Z"),
      },
    });
    const fullAddressOnly = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId,
        needId: requestsNeedId,
        title: "Address only safe request",
        description: "Public safe text has no private term here.",
        fullAddress: "Vault term address",
        createdAt: new Date("2026-09-22T00:07:00.000Z"),
      },
    });
    await db.helpRequestResponse.create({
      data: {
        requestId: fullAddressOnly.id,
        responderUserId: responder.id,
        message: "secret response goalkeeper phrase",
      },
    });

    const byTitle = await repository.listPublic({ q: "goalkeeper gloves", limit: 10 });
    assert.deepEqual(
      byTitle.items.map((item) => item.id),
      [titleMatch.id],
    );

    const byDescription = await repository.listPublic({ q: "SWEEPERKEEPER", limit: 10 });
    assert.deepEqual(
      byDescription.items.map((item) => item.id),
      [descriptionMatch.id],
    );

    const byCustomNeed = await repository.listPublic({ q: "jersey", limit: 10 });
    assert.deepEqual(
      byCustomNeed.items.map((item) => item.id),
      [customNeedMatch.id],
    );

    const playOnly = await repository.listPublic({ q: "goalkeeper", surface: "PLAY", limit: 10 });
    assert.deepEqual(
      playOnly.items.map((item) => item.id),
      [playMatch.id],
    );

    const taxonomyOnly = await repository.listPublic({
      q: "goalkeeper",
      needId: requestsNeedId,
      limit: 10,
    });
    assert.deepEqual(
      taxonomyOnly.items.map((item) => item.id),
      [customNeedMatch.id, descriptionMatch.id, titleMatch.id],
    );

    const paged = await repository.listPublic({
      q: "goalkeeper",
      needId: requestsNeedId,
      limit: 1,
    });
    assert.deepEqual(
      paged.items.map((item) => item.id),
      [customNeedMatch.id],
    );
    assert.equal(paged.nextCursor, customNeedMatch.id);

    const safeFieldsOnly = await repository.listPublic({ q: "vault", limit: 10 });
    assert.deepEqual(safeFieldsOnly.items, []);

    const responseTextOnly = await repository.listPublic({ q: "secret response", limit: 10 });
    assert.deepEqual(responseTextOnly.items, []);
  } finally {
    await db.helpRequestResponse.deleteMany({ where: { responderUserId: responder.id } });
    await db.helpRequest.deleteMany({ where: { createdByUserId: owner.id } });
    await db.helpTaxonomyNeed.deleteMany({ where: { subcategoryId } });
    await db.helpTaxonomySubcategory.deleteMany({ where: { id: subcategoryId } });
    await db.community.deleteMany({ where: { id: communityId } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, responder.id] } } });
    await db.$disconnect();
  }
});
