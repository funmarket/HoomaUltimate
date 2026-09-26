import assert from "node:assert/strict";
import test from "node:test";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

function searchClause(q: string) {
  return [
    {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { customNeed: { contains: q, mode: "insensitive" } },
      ],
    },
  ];
}

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
    category: "ITEM",
    surface: "REQUESTS",
    requestType: "SPORT",
    sport: "FOOTBALL",
    subcategoryId: "subcategory-1",
    needId: "need-1",
    city: "Tunis",
    houma: "Medina",
    status: "OPEN",
    cursor: "cursor-1",
    limit: 1,
  });

  const query = calls[0] as {
    readonly where: Record<string, unknown>;
    readonly take: number;
    readonly cursor?: unknown;
    readonly skip?: number;
  };
  assert.equal(query.take, 2);
  assert.deepEqual(query.cursor, { id: "cursor-1" });
  assert.equal(query.skip, 1);
  assert.equal(query.where.audienceScope, "PUBLIC");
  assert.deepEqual(query.where.status, { in: ["OPEN"] });
  assert.equal(query.where.category, "ITEM");
  assert.equal(query.where.requestType, "SPORT");
  assert.equal(query.where.sport, "FOOTBALL");
  assert.equal(query.where.subcategoryId, "subcategory-1");
  assert.equal(query.where.needId, "need-1");
  assert.equal(query.where.city, "Tunis");
  assert.equal(query.where.houma, "Medina");
  assert.deepEqual(query.where.taxonomyNeed, { surfaces: { some: { surface: "REQUESTS" } } });
  assert.deepEqual(query.where.AND, searchClause("goalkeeper"));
  assert.equal(query.where.fullAddress, undefined);
  assert.equal(query.where.locationNote, undefined);
  assert.equal(query.where.responses, undefined);
});

test("Request repository keeps q search separate from member visibility", async () => {
  const calls: unknown[] = [];
  const db = {
    communityMembership: { findMany: async () => [{ communityId: "community-1" }] },
    athletesMembership: {
      findMany: async () => [{ athletesCommunityId: "athletes-1" }],
    },
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
    limit: 10,
  });

  const query = calls[0] as { readonly where: Record<string, unknown> };
  assert.deepEqual(query.where.AND, searchClause("goalkeeper"));
  assert.deepEqual(query.where.OR, [
    { createdByUserId: "user-1" },
    { audienceScope: "PUBLIC" },
    { audienceScope: "HOOMA_COMMUNITY", audienceCommunityId: { in: ["community-1"] } },
    {
      audienceScope: "ATHLETES_COMMUNITY",
      audienceAthletesCommunityId: { in: ["athletes-1"] },
    },
  ]);
});

test("surface search preserves Play and Athletes server-side projection constraints", async () => {
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

  await repository.listPublic({ q: "keeper", surface: "PLAY", limit: 10 });
  await repository.listPublic({ q: "racket", surface: "ATHLETES", limit: 10 });

  const play = calls[0] as { readonly where: Record<string, unknown> };
  assert.deepEqual(play.where.taxonomyNeed, { surfaces: { some: { surface: "PLAY" } } });
  assert.equal(play.where.requestType, "SPORT");
  assert.equal(play.where.sport, "FOOTBALL");
  assert.deepEqual(play.where.AND, searchClause("keeper"));

  const athletes = calls[1] as { readonly where: Record<string, unknown> };
  assert.deepEqual(athletes.where.taxonomyNeed, {
    surfaces: { some: { surface: "ATHLETES" } },
  });
  assert.equal(athletes.where.requestType, "SPORT");
  assert.deepEqual(athletes.where.NOT, { sport: "FOOTBALL" });
  assert.deepEqual(athletes.where.AND, searchClause("racket"));
});
