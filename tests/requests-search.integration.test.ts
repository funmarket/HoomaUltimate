import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("Request search composes visibility, surfaces and pagination without private-field leakage", async () => {
  const repository = new PrismaRequestRepository(db);
  const owner = await db.user.create({ data: {} });
  const member = await db.user.create({ data: {} });
  const responder = await db.user.create({ data: {} });
  const suffix = owner.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const communityId = `rq-search-community-${suffix}`;
  const sportSubcategoryId = `rq-search-sport-${suffix}`;
  const footballSubcategoryId = `rq-search-football-${suffix}`;
  const communitySubcategoryId = `rq-search-community-sub-${suffix}`;
  const requestsNeedId = `rq-search-requests-${suffix}`;
  const playNeedId = `rq-search-play-${suffix}`;
  const athletesNeedId = `rq-search-athletes-${suffix}`;
  const athletesFootballNeedId = `rq-search-athletes-football-${suffix}`;
  const athletesCommunityNeedId = `rq-search-athletes-community-${suffix}`;

  await db.community.create({
    data: {
      id: communityId,
      slug: `rq-search-${suffix}`,
      name: "RQ Search Community",
      createdByUserId: owner.id,
      memberships: { create: [{ userId: member.id, role: "MEMBER" }] },
    },
  });
  await db.helpTaxonomySubcategory.createMany({
    data: [
      {
        id: sportSubcategoryId,
        requestType: "SPORT",
        sport: "OTHER",
        slug: `rq-search-sport-${suffix}`,
        label: "Search sport",
        sortOrder: 991,
      },
      {
        id: footballSubcategoryId,
        requestType: "SPORT",
        sport: "FOOTBALL",
        slug: `rq-search-football-${suffix}`,
        label: "Search football",
        sortOrder: 992,
      },
      {
        id: communitySubcategoryId,
        requestType: "COMMUNITY",
        sport: null,
        slug: `rq-search-community-${suffix}`,
        label: "Search community",
        sortOrder: 993,
      },
    ],
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: requestsNeedId,
      subcategoryId: sportSubcategoryId,
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
      subcategoryId: footballSubcategoryId,
      slug: `play-${suffix}`,
      label: "Play search",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 20,
      surfaces: { create: [{ surface: "PLAY" }] },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: athletesNeedId,
      subcategoryId: sportSubcategoryId,
      slug: `athletes-${suffix}`,
      label: "Athletes search",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 30,
      surfaces: { create: [{ surface: "ATHLETES" }] },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: athletesFootballNeedId,
      subcategoryId: footballSubcategoryId,
      slug: `athletes-football-${suffix}`,
      label: "Athletes football search guard",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 40,
      surfaces: { create: [{ surface: "ATHLETES" }] },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: athletesCommunityNeedId,
      subcategoryId: communitySubcategoryId,
      slug: `athletes-community-${suffix}`,
      label: "Athletes community search guard",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 50,
      surfaces: { create: [{ surface: "ATHLETES" }] },
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
        subcategoryId: sportSubcategoryId,
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
        subcategoryId: sportSubcategoryId,
        needId: requestsNeedId,
        title: "Training support needed",
        description: "A young goalkeeper needs practice cones.",
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
        subcategoryId: sportSubcategoryId,
        needId: requestsNeedId,
        customNeed: "Goalkeeper jersey set",
        title: "Specific kit request",
        description: "Looking for a custom item for training.",
        createdAt: new Date("2026-09-22T00:03:00.000Z"),
      },
    });
    const privateMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "HOOMA_COMMUNITY",
        audienceCommunityId: communityId,
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId: sportSubcategoryId,
        needId: requestsNeedId,
        title: "Private goalkeeper request",
        description: "Visible only to the selected community.",
        createdAt: new Date("2026-09-22T00:04:00.000Z"),
      },
    });
    const playMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "FOOTBALL",
        subcategoryId: footballSubcategoryId,
        needId: playNeedId,
        title: "Goalkeeper warmup help",
        description: "This request belongs to Play.",
        createdAt: new Date("2026-09-22T00:05:00.000Z"),
      },
    });
    const athletesMatch = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId: sportSubcategoryId,
        needId: athletesNeedId,
        title: "Goalkeeper cross-training partner",
        description: "This non-football request belongs to Athletes.",
        createdAt: new Date("2026-09-22T00:06:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "FOOTBALL",
        subcategoryId: footballSubcategoryId,
        needId: athletesFootballNeedId,
        title: "Goalkeeper football request",
        description: "Football must remain excluded from Athletes.",
        createdAt: new Date("2026-09-22T00:07:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "COMMUNITY",
        sport: null,
        subcategoryId: communitySubcategoryId,
        needId: athletesCommunityNeedId,
        title: "Goalkeeper community request",
        description: "Community must remain excluded from Athletes.",
        createdAt: new Date("2026-09-22T00:08:00.000Z"),
      },
    });
    await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId: sportSubcategoryId,
        needId: requestsNeedId,
        title: "Newest unrelated request",
        description: "This row must not consume the filtered page limit.",
        createdAt: new Date("2026-09-22T00:09:00.000Z"),
      },
    });
    const privateTextOnly = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        requestType: "SPORT",
        sport: "OTHER",
        subcategoryId: sportSubcategoryId,
        needId: requestsNeedId,
        title: "Safe public request",
        description: "Its searchable text contains no private phrase.",
        fullAddress: "Vault term address",
        createdAt: new Date("2026-09-22T00:10:00.000Z"),
      },
    });
    await db.helpRequestResponse.create({
      data: {
        requestId: privateTextOnly.id,
        responderUserId: responder.id,
        message: "secret response goalkeeper phrase",
      },
    });

    const publicResults = await repository.listPublic({
      q: "goalkeeper",
      surface: "REQUESTS",
      limit: 10,
    });
    assert.deepEqual(
      publicResults.items.map((item) => item.id),
      [customNeedMatch.id, descriptionMatch.id, titleMatch.id],
    );

    const memberResults = await repository.listVisibleToMember(member.id, {
      q: "goalkeeper",
      surface: "REQUESTS",
      limit: 10,
    });
    assert.deepEqual(
      memberResults.items.map((item) => item.id),
      [privateMatch.id, customNeedMatch.id, descriptionMatch.id, titleMatch.id],
    );

    const paged = await repository.listPublic({
      q: "goalkeeper",
      surface: "REQUESTS",
      limit: 1,
    });
    assert.deepEqual(
      paged.items.map((item) => item.id),
      [customNeedMatch.id],
    );
    assert.equal(paged.nextCursor, customNeedMatch.id);

    const playResults = await repository.listPublic({
      q: "goalkeeper",
      surface: "PLAY",
      limit: 10,
    });
    assert.deepEqual(
      playResults.items.map((item) => item.id),
      [playMatch.id],
    );

    const athletesResults = await repository.listPublic({
      q: "goalkeeper",
      surface: "ATHLETES",
      limit: 10,
    });
    assert.deepEqual(
      athletesResults.items.map((item) => item.id),
      [athletesMatch.id],
    );

    assert.deepEqual((await repository.listPublic({ q: "vault", limit: 10 })).items, []);
    assert.deepEqual((await repository.listPublic({ q: "secret response", limit: 10 })).items, []);
  } finally {
    await db.helpRequestResponse.deleteMany({ where: { responderUserId: responder.id } });
    await db.helpRequest.deleteMany({ where: { createdByUserId: owner.id } });
    await db.helpTaxonomyNeed.deleteMany({
      where: {
        id: {
          in: [
            requestsNeedId,
            playNeedId,
            athletesNeedId,
            athletesFootballNeedId,
            athletesCommunityNeedId,
          ],
        },
      },
    });
    await db.helpTaxonomySubcategory.deleteMany({
      where: { id: { in: [sportSubcategoryId, footballSubcategoryId, communitySubcategoryId] } },
    });
    await db.community.deleteMany({ where: { id: communityId } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, member.id, responder.id] } } });
    await db.$disconnect();
  }
});
