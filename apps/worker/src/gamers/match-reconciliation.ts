import type { PrismaClient } from "@hooma/database";

const BATCH_SIZE = 50;

function winnerSide(challengerScore: number, challengedScore: number) {
  if (challengerScore === challengedScore) return null;
  return challengerScore > challengedScore ? ("CHALLENGER" as const) : ("CHALLENGED" as const);
}

export type GamerMatchReconciliationResult = {
  scanned: number;
  verified: number;
  disputed: number;
  failed: number;
};

export async function reconcileGamerMatches(
  database: PrismaClient,
  now = new Date(),
): Promise<GamerMatchReconciliationResult> {
  const matches = await database.gamerMatchSession.findMany({
    where: { status: "PENDING_VERIFICATION" },
    orderBy: [{ submissionDeadline: "asc" }, { updatedAt: "asc" }],
    take: BATCH_SIZE,
    include: { submissions: { orderBy: { submittedAt: "asc" } } },
  });
  const result: GamerMatchReconciliationResult = {
    scanned: matches.length,
    verified: 0,
    disputed: 0,
    failed: 0,
  };

  for (const match of matches) {
    try {
      if (match.submissions.length >= 2) {
        const challenger = match.submissions.find((item) => item.side === "CHALLENGER");
        const challenged = match.submissions.find((item) => item.side === "CHALLENGED");
        if (!challenger || !challenged) continue;
        const aligned =
          challenger.challengerScore === challenged.challengerScore &&
          challenger.challengedScore === challenged.challengedScore;
        if (aligned) {
          const updated = await database.gamerMatchSession.updateMany({
            where: { id: match.id, status: "PENDING_VERIFICATION" },
            data: {
              status: "VERIFIED",
              finalChallengerScore: challenger.challengerScore,
              finalChallengedScore: challenger.challengedScore,
              winnerSide: winnerSide(challenger.challengerScore, challenger.challengedScore),
              resolution: "MATCHED_SUBMISSIONS",
              resolvedAt: now,
            },
          });
          result.verified += updated.count;
        } else {
          const updated = await database.gamerMatchSession.updateMany({
            where: { id: match.id, status: "PENDING_VERIFICATION" },
            data: { status: "DISPUTED" },
          });
          result.disputed += updated.count;
        }
        continue;
      }

      const submission = match.submissions[0];
      if (!submission || !match.submissionDeadline || match.submissionDeadline > now) continue;
      const updated = await database.gamerMatchSession.updateMany({
        where: { id: match.id, status: "PENDING_VERIFICATION" },
        data: {
          status: "VERIFIED",
          finalChallengerScore: submission.challengerScore,
          finalChallengedScore: submission.challengedScore,
          winnerSide: winnerSide(submission.challengerScore, submission.challengedScore),
          resolution: "SINGLE_SUBMISSION_TIMEOUT",
          resolvedAt: now,
        },
      });
      result.verified += updated.count;
    } catch (error) {
      result.failed += 1;
      console.error("Gamer match reconciliation failed for one match", {
        matchId: match.id,
        error,
      });
    }
  }

  return result;
}
