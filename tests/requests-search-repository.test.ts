import assert from "node:assert/strict";
import test from "node:test";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

test("Request repository composes canonical q search with public filters before pagination", async () => {
  const calls: unknown[] = [];
  const db = {
    helpRequest: {
      findMany: async (input: unknown) => {
        calls.push(input);
        return [];
      },
    },
  };
  const repository = new PrismaRequestRepository(db as never);

  await repository.listPublic({
    q: "goalkeeper",
    surface: "REQUESTS",
    requestType: "SPORT",
    sport: "FOOTBALL",
    subcategoryId: "subcategory-1",
    needId: "need-1",
    status: "OPEN",
    cursor: "cursor-1",
    limit: 1,
  });

  assert.equal(calls.length, 1);
  const query = calls[0] as {
    readonly where: Record<string, unknown>;
    readonly take: number;
    readonly cursor?: unknown;
  };
  assert.equal(query.take, 2);
  assert.deepEqual(query.cursor, { id: "cursor-1" });
  assert.equal(query.where.audienceScope, "PUBLIC");
  assert.deepEqual(query.where.status, { in: ["OPEN"] });
  assert.equal(query.where.requestType, "SPORT");
  assert.equal(query.where.sport, "FOOTBALL");
  assert.equal(query.where.subcategoryId, "subcategory-1");
  assert.equal(query.where.needId, "need-1");
  assert.deepEqual(query.where.taxonomyNeed, { surfaces: { some: { surface: "REQUESTS" } } });
  assert.deepEqual(query.where.AND, [
    {
      OR: [
        { title: { contains: "goalkeeper", mode: "insensitive" } },
        { description: { contains: "goalkeeper", mode: "insensitive" } },
        { customNeed: { contains: "goalkeeper", mode: "insensitive" } },
      ],
    },
  ]);
  assert.equal(query.where.fullAddress, undefined);
  assert.equal(query.where.locationNote, undefined);
  assert.equal(query.where.requester, undefined);
  assert.equal(query.where.responses, undefined);
});

test("Request repository keeps q search separate from member visibility OR", async () => {
  const calls: unknown[] = [];
  const db = {
    communityMembership: { findMany: async () => [] },
    athletesMembership: { findMany: async () => [] },
    helpRequest: {
      findMany: async (input: unknown) => {
        calls.push(input);
        return [];
      },
    },
  };
  const repository = new PrismaRequestRepository(db as never);

  await repository.listVisibleToMember("user-1", {
    q: "goalkeeper",
    requestType: "COMMUNITY",
    subcategoryId: "community-category-1",
    needId: "community-need-1",
    city: "Tunis",
    houma: "Medina",
    limit: 10,
  });

  const query = calls[0] as { readonly where: Record<string, unknown> };
  assert.deepEqual(query.where.AND, [
    {
      OR: [
        { title: { contains: "goalkeeper", mode: "insensitive" } },
        { description: { contains: "goalkeeper", mode: "insensitive" } },
        { customNeed: { contains: "goalkeeper", mode: "insensitive" } },
      ],
    },
  ]);
  assert.equal(query.where.requestType, "COMMUNITY");
  assert.equal(query.where.subcategoryId, "community-category-1");
  assert.equal(query.where.needId, "community-need-1");
  assert.equal(query.where.city, "Tunis");
  assert.equal(query.where.houma, "Medina");
  assert.deepEqual(query.where.OR, [
    { createdByUserId: "user-1" },
    { audienceScope: "PUBLIC" },
    { audienceScope: "HOOMA_COMMUNITY", audienceCommunityId: { in: [] } },
    { audienceScope: "ATHLETES_COMMUNITY", audienceAthletesCommunityId: { in: [] } },
  ]);
});
