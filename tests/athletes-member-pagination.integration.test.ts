import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";

const db = getDatabaseClient();

async function collectPages<T extends { userId: string }>(
  read: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
) {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await read(cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

test(
  "Athletes member and join-request cursors traverse more than 1000 tied rows exactly once",
  async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const founderId = `ath-page-founder-${suffix}`;
    const memberCommunityId = `ath-page-members-${suffix}`;
    const requestCommunityId = `ath-page-requests-${suffix}`;
    const tiedAt = new Date("2026-09-14T12:00:00.000Z");
    const userIds = Array.from(
      { length: 1050 },
      (_, index) => `ath-page-user-${suffix}-${String(index).padStart(4, "0")}`,
    );

    try {
      await db.user.createMany({
        data: [{ id: founderId }, ...userIds.map((id) => ({ id }))],
      });
      await db.athletesCommunity.createMany({
        data: [
          {
            id: memberCommunityId,
            slug: `ath-page-members-${suffix}`,
            name: "Pagination Members",
            sport: "RUNNING",
            visibility: "PRIVATE",
            joinPolicy: "APPROVAL_REQUIRED",
            createdByUserId: founderId,
          },
          {
            id: requestCommunityId,
            slug: `ath-page-requests-${suffix}`,
            name: "Pagination Requests",
            sport: "RUNNING",
            visibility: "PRIVATE",
            joinPolicy: "APPROVAL_REQUIRED",
            createdByUserId: founderId,
          },
        ],
      });
      await db.athletesMembership.createMany({
        data: userIds.map((userId, index) => ({
          id: `ath-page-membership-${suffix}-${String(index).padStart(4, "0")}`,
          athletesCommunityId: memberCommunityId,
          userId,
          role: "MEMBER",
          joinedAt: tiedAt,
        })),
      });
      await db.athletesJoinRequest.createMany({
        data: userIds.map((userId, index) => ({
          id: `ath-page-request-${suffix}-${String(index).padStart(4, "0")}`,
          athletesCommunityId: requestCommunityId,
          userId,
          status: "PENDING",
          requestedAt: tiedAt,
        })),
      });

      const repository = new PrismaAthletesRepository(db);
      const members = await collectPages((cursor) =>
        repository.listMembers(memberCommunityId, {
          limit: 100,
          ...(cursor ? { cursor } : {}),
        }),
      );
      const requests = await collectPages((cursor) =>
        repository.listJoinRequests(requestCommunityId, {
          limit: 100,
          ...(cursor ? { cursor } : {}),
        }),
      );

      assert.equal(members.length, 1050);
      assert.equal(new Set(members.map((member) => member.userId)).size, 1050);
      assert.deepEqual(
        members.map((member) => member.userId),
        userIds,
      );
      assert.equal(requests.length, 1050);
      assert.equal(new Set(requests.map((request) => request.id)).size, 1050);
      assert.deepEqual(
        requests.map((request) => request.userId),
        userIds,
      );

      const memberPlan = await db.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT "id" FROM "AthletesMembership" WHERE "athletesCommunityId" = $1 AND "leftAt" IS NULL ORDER BY "role" ASC, "joinedAt" ASC, "id" ASC LIMIT 101`,
        memberCommunityId,
      );
      const requestPlan = await db.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN (ANALYZE, BUFFERS) SELECT "id" FROM "AthletesJoinRequest" WHERE "athletesCommunityId" = $1 AND "status" = 'PENDING' ORDER BY "requestedAt" ASC, "id" ASC LIMIT 101`,
        requestCommunityId,
      );
      console.log(
        "Athletes member pagination plan:\n" + memberPlan.map((row) => row["QUERY PLAN"]).join("\n"),
      );
      console.log(
        "Athletes join-request pagination plan:\n" +
          requestPlan.map((row) => row["QUERY PLAN"]).join("\n"),
      );
    } finally {
      await db.athletesCommunity.deleteMany({
        where: { id: { in: [memberCommunityId, requestCommunityId] } },
      });
      await db.user.deleteMany({ where: { id: { in: [founderId, ...userIds] } } });
    }
  },
);
