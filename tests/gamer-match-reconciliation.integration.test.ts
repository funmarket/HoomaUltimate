import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { reconcileGamerMatches } from "../apps/worker/src/gamers/match-reconciliation.js";

const db = getDatabaseClient();
const prefix = "ea-fc-reconcile-";

async function cleanup() {
  const presentations = await db.userPresentation.findMany({
    where: { username: { startsWith: prefix } },
    select: { userId: true },
  });
  const userIds = presentations.map((item) => item.userId);
  if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture(suffix: string) {
  const game = await db.gamerGame.findUnique({ where: { slug: "ea-sports-fc-mobile" } });
  assert.ok(game);
  const challengerUser = await db.user.create({
    data: {
      identities: ["GAMER"],
      presentation: {
        create: { username: `${prefix}${suffix}-a`, displayName: `EA A ${suffix}` },
      },
    },
  });
  const challengedUser = await db.user.create({
    data: {
      identities: ["GAMER"],
      presentation: {
        create: { username: `${prefix}${suffix}-b`, displayName: `EA B ${suffix}` },
      },
    },
  });
  const challenger = await db.gamerProfile.create({
    data: {
      userId: challengerUser.id,
      gameId: game.id,
      handle: `${suffix}-a`,
      openToChallenge: true,
    },
  });
  const challenged = await db.gamerProfile.create({
    data: {
      userId: challengedUser.id,
      gameId: game.id,
      handle: `${suffix}-b`,
      openToChallenge: true,
    },
  });
  const challenge = await db.gamerChallenge.create({
    data: {
      gameId: game.id,
      challengerProfileId: challenger.id,
      challengedProfileId: challenged.id,
      pairKey: [challenger.id, challenged.id].sort().join(":"),
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });
  const match = await db.gamerMatchSession.create({
    data: { challengeId: challenge.id, status: "PENDING_VERIFICATION", roomCode: "582910" },
  });
  return match;
}

async function addSubmission(
  matchId: string,
  side: "CHALLENGER" | "CHALLENGED",
  challengerScore: number,
  challengedScore: number,
) {
  return db.gamerMatchSubmission.create({
    data: {
      matchSessionId: matchId,
      side,
      challengerScore,
      challengedScore,
      proofObjectKey: `proof/${matchId}/${side}`,
      proofContentType: "image/png",
      proofSizeBytes: 100,
    },
  });
}

test("Gamer match reconciliation verifies aligned scorecards and disputes conflicts", async () => {
  await cleanup();
  try {
    const aligned = await createFixture("aligned");
    await addSubmission(aligned.id, "CHALLENGER", 3, 1);
    await addSubmission(aligned.id, "CHALLENGED", 3, 1);

    const conflict = await createFixture("conflict");
    await addSubmission(conflict.id, "CHALLENGER", 3, 1);
    await addSubmission(conflict.id, "CHALLENGED", 0, 2);

    const result = await reconcileGamerMatches(db, new Date());
    assert.ok(result.scanned >= 2);

    const alignedAfter = await db.gamerMatchSession.findUnique({ where: { id: aligned.id } });
    assert.equal(alignedAfter?.status, "VERIFIED");
    assert.equal(alignedAfter?.resolution, "MATCHED_SUBMISSIONS");
    assert.equal(alignedAfter?.finalChallengerScore, 3);
    assert.equal(alignedAfter?.finalChallengedScore, 1);
    assert.equal(alignedAfter?.winnerSide, "CHALLENGER");

    const conflictAfter = await db.gamerMatchSession.findUnique({ where: { id: conflict.id } });
    assert.equal(conflictAfter?.status, "DISPUTED");
    assert.equal(conflictAfter?.resolvedAt, null);
  } finally {
    await cleanup();
  }
});

test(
  "Gamer match reconciliation resolves one expired scorecard after the ghosting window",
  async () => {
    await cleanup();
    try {
      const match = await createFixture("timeout");
      await addSubmission(match.id, "CHALLENGER", 2, 0);
      await db.gamerMatchSession.update({
        where: { id: match.id },
        data: { submissionDeadline: new Date("2026-08-26T10:00:00.000Z") },
      });

      await reconcileGamerMatches(db, new Date("2026-08-26T10:30:00.000Z"));
      const after = await db.gamerMatchSession.findUnique({ where: { id: match.id } });
      assert.equal(after?.status, "VERIFIED");
      assert.equal(after?.resolution, "SINGLE_SUBMISSION_TIMEOUT");
      assert.equal(after?.finalChallengerScore, 2);
      assert.equal(after?.finalChallengedScore, 0);
    } finally {
      await cleanup();
    }
  },
);
