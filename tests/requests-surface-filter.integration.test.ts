import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("canonical surface projections are enforced before cursor pagination without copying Requests", async () => {
  const repository = new PrismaRequestRepository(db);
  const user = await db.user.create({ data: {} });
  const suffix = user.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const footballSubcategoryId = `test-rq-surface-football-${suffix}`;
  const runningSubcategoryId = `test-rq-surface-running-${suffix}`;
  const communitySubcategoryId = `test-rq-surface-community-${suffix}`;
  const footballNeedId = `test-rq-surface-football-need-${suffix}`;
  const runningNeedId = `test-rq-surface-running-need-${suffix}`;
  const communityNeedId = `test-rq-surface-community-need-${suffix}`;
  const subcategoryIds = [footballSubcategoryId, runningSubcategoryId, communitySubcategoryId];

  await db.helpTaxonomySubcategory.createMany({
    data: [
      {
        id: footballSubcategoryId,
        requestType: "SPORT",
        sport: "FOOTBALL",
        slug: `rq-surface-football-${suffix}`,
        label: "Football test",
        sortOrder: 997,
      },
      {
        id: runningSubcategoryId,
        requestType: "SPORT",
        sport: "RUNNING",
        slug: `rq-surface-running-${suffix}`,
        label: "Running test",
        sortOrder: 998,
      },
      {
        id: communitySubcategoryId,
        requestType: "COMMUNITY",
        sport: null,
        slug: `rq-surface-community-${suffix}`,
        label: "Community test",
        sortOrder: 999,
      },
    ],
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: footballNeedId,
      subcategoryId: footballSubcategoryId,
      slug: `football-${suffix}`,
      label: "Football need",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 10,
      surfaces: { create: [{ surface: "REQUESTS" }, { surface: "PLAY" }] },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: runningNeedId,
      subcategoryId: runningSubcategoryId,
      slug: `running-${suffix}`,
      label: "Running need",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 20,
      surfaces: {
        create: [{ surface: "REQUESTS" }, { surface: "PLAY" }, { surface: "ATHLETES" }],
      },
    },
  });
  await db.helpTaxonomyNeed.create({
    data: {
      id: communityNeedId,
      subcategoryId: communitySubcategoryId,
      slug: `community-${suffix}`,
      label: "Community need",
      kind: "COMMUNITY_SUPPORT",
      sortOrder: 30,
      surfaces: {
        create: [{ surface: "REQUESTS" }, { surface: "PLAY" }, { surface: "ATHLETES" }],
      },
    },
  });

  try {
    const football = await db.helpRequest.create({
      data: {
        createdByUserId: user.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "SPORT",
        sport: "FOOTBALL",
        subcategoryId: footballSubcategoryId,
        needId: footballNeedId,
        title: "Older Football request",
        description: "This canonical Request belongs on Requests and Play.",
        createdAt: new Date("2026-09-22T00:00:00.000Z"),
      },
    });
    const running = await db.helpRequest.create({
      data: {
        createdByUserId: user.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "SPORT",
        sport: "RUNNING",
        subcategoryId: runningSubcategoryId,
        needId: runningNeedId,
        title: "Newer Running request",
        description: "This canonical Request belongs on Requests and Athletes, never Play.",
        createdAt: new Date("2026-09-22T00:01:00.000Z"),
      },
    });
    const community = await db.helpRequest.create({
      data: {
        createdByUserId: user.id,
        audienceScope: "PUBLIC",
        category: "COMMUNITY",
        requestType: "COMMUNITY",
        sport: null,
        subcategoryId: communitySubcategoryId,
        needId: communityNeedId,
        title: "Newest Community request",
        description: "This canonical Request belongs only on standalone Requests.",
        createdAt: new Date("2026-09-22T00:02:00.000Z"),
      },
    });

    const requestsPage = await repository.listPublic({ surface: "REQUESTS", limit: 10 });
    const playPage = await repository.listPublic({
      surface: "PLAY",
      requestType: "COMMUNITY",
      sport: "RUNNING",
      limit: 1,
    });
    const athletesPage = await repository.listPublic({ surface: "ATHLETES", limit: 10 });

    assert.deepEqual(
      new Set(requestsPage.items.map((item) => item.id)),
      new Set([football.id, running.id, community.id]),
    );
    assert.deepEqual(
      playPage.items.map((item) => item.id),
      [football.id],
    );
    assert.equal(playPage.nextCursor, null);
    assert.deepEqual(
      athletesPage.items.map((item) => item.id),
      [running.id],
    );
  } finally {
    await db.helpRequest.deleteMany({ where: { createdByUserId: user.id } });
    await db.helpTaxonomyNeed.deleteMany({ where: { subcategoryId: { in: subcategoryIds } } });
    await db.helpTaxonomySubcategory.deleteMany({ where: { id: { in: subcategoryIds } } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
