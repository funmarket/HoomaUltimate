import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import type { AuditWriter } from "../apps/api/src/modules/audit/application/audit-writer.js";
import { PrismaAuditWriter } from "../apps/api/src/modules/audit/infrastructure/prisma-audit-writer.js";
import { PrismaGamerMatchRepository } from "../apps/api/src/modules/gamers/infrastructure/prisma-gamer-match.repository.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Gamer dispute Audit integration tests");
}

const db = getDatabaseClient();

test("Gamer dispute resolution preserves Audit actions and rolls back when Audit fails", async () => {
  const id = randomUUID().replaceAll("-", "");
  const game = await db.gamerGame.create({
    data: { slug: `audit-dispute-${id}`, name: `Audit dispute ${id}`, normalizedName: `audit dispute ${id}` },
  });
  const users: string[] = [];
  const matches: string[] = [];
  try {
    for (const suffix of ["a", "b"]) {
      const user = await db.user.create({
        data: { identities: ["GAMER"], presentation: { create: { username: `audit-${id}-${suffix}`, displayName: suffix } } },
      });
      users.push(user.id);
    }
    const profiles = [];
    for (const [index, userId] of users.entries()) {
      profiles.push(await db.gamerProfile.create({
        data: { userId, gameId: game.id, handle: `audit-${id}-${index}`, openToChallenge: false },
      }));
    }
    for (let index = 0; index < 3; index++) {
      const challenge = await db.gamerChallenge.create({
        data: {
          gameId: game.id,
          challengerProfileId: profiles[0]!.id,
          challengedProfileId: profiles[1]!.id,
          pairKey: `audit-${id}-${index}`,
          status: "ACCEPTED",
        },
      });
      const match = await db.gamerMatchSession.create({
        data: { challengeId: challenge.id, status: "DISPUTED" },
      });
      matches.push(match.id);
    }

    const repository = new PrismaGamerMatchRepository(db, new PrismaAuditWriter(db));
    const resolved = await repository.resolveDispute({
      matchId: matches[0]!,
      actorUserId: users[0]!,
      resolution: { decision: "SCORE", challengerScore: 2, challengedScore: 1, moderatorNotes: "score proof" },
    });
    assert.equal(resolved?.status, "VERIFIED");
    const resolvedAudit = await db.auditLog.findFirst({ where: { entityId: matches[0] } });
    assert.equal(resolvedAudit?.action, "GAMER_MATCH_DISPUTE_RESOLVED");
    assert.equal(resolvedAudit?.actorUserId, users[0]);
    assert.deepEqual(resolvedAudit?.metadata, {
      challengeId: resolved?.challengeId,
      decision: "SCORE",
      challengerScore: 2,
      challengedScore: 1,
      moderatorNotes: "score proof",
    });

    const voided = await repository.resolveDispute({
      matchId: matches[1]!,
      actorUserId: users[0]!,
      resolution: { decision: "VOID", moderatorNotes: "void proof" },
    });
    assert.equal(voided?.status, "VOIDED");
    const voidedAudit = await db.auditLog.findFirst({ where: { entityId: matches[1] } });
    assert.equal(voidedAudit?.action, "GAMER_MATCH_DISPUTE_VOIDED");
    assert.deepEqual(voidedAudit?.metadata, {
      challengeId: voided?.challengeId,
      decision: "VOID",
      moderatorNotes: "void proof",
    });

    const failure = new Error("intentional Audit failure");
    const failingWriter: AuditWriter = {
      write: async () => { throw failure; },
      writeInTransaction: async () => { throw failure; },
    };
    await assert.rejects(
      new PrismaGamerMatchRepository(db, failingWriter).resolveDispute({
        matchId: matches[2]!,
        actorUserId: users[0]!,
        resolution: { decision: "VOID", moderatorNotes: "must roll back" },
      }),
      (error: unknown) => error === failure,
    );
    const unchanged = await db.gamerMatchSession.findUniqueOrThrow({ where: { id: matches[2] } });
    assert.equal(unchanged.status, "DISPUTED");
    assert.equal(await db.auditLog.count({ where: { entityId: matches[2] } }), 0);
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: { in: matches } } });
    await db.gamerGame.delete({ where: { id: game.id } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  }
});
