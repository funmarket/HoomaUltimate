import type { PrismaClient } from "@hooma/database";
import type { GamerDisputeResolutionInput, GamerMatchSide } from "@hooma/contracts/gamers";
import type {
  GamerMatchDisputeRecord,
  GamerMatchRepository,
  GamerMatchSessionRecord,
  GamerMatchSubmissionRecord,
} from "../application/gamer-match.repository.js";

const presentationSelect = {
  username: true,
  displayName: true,
  photoUrl: true,
} as const;

const submissionSelect = {
  id: true,
  side: true,
  challengerScore: true,
  challengedScore: true,
  proofObjectKey: true,
  proofContentType: true,
  proofSizeBytes: true,
  submittedAt: true,
} as const;

const sessionInclude = {
  submissions: { select: submissionSelect, orderBy: { submittedAt: "asc" as const } },
} as const;

function mapSubmission(row: {
  id: string;
  side: GamerMatchSide;
  challengerScore: number;
  challengedScore: number;
  proofObjectKey: string;
  proofContentType: string;
  proofSizeBytes: number;
  submittedAt: Date;
}): GamerMatchSubmissionRecord {
  return row;
}

function mapSession(row: {
  id: string;
  challengeId: string;
  status: GamerMatchSessionRecord["status"];
  roomCode: string | null;
  submissionDeadline: Date | null;
  finalChallengerScore: number | null;
  finalChallengedScore: number | null;
  winnerSide: GamerMatchSide | null;
  resolution: GamerMatchSessionRecord["resolution"];
  resolvedAt: Date | null;
  submissions: Array<Parameters<typeof mapSubmission>[0]>;
}): GamerMatchSessionRecord {
  return { ...row, submissions: row.submissions.map(mapSubmission) };
}

function winnerSide(challengerScore: number, challengedScore: number): GamerMatchSide | null {
  if (challengerScore === challengedScore) return null;
  return challengerScore > challengedScore ? "CHALLENGER" : "CHALLENGED";
}

export class PrismaGamerMatchRepository implements GamerMatchRepository {
  constructor(private readonly database: PrismaClient) {}

  async getByChallengeId(challengeId: string): Promise<GamerMatchSessionRecord | null> {
    const row = await this.database.gamerMatchSession.findUnique({
      where: { challengeId },
      include: sessionInclude,
    });
    return row ? mapSession(row) : null;
  }

  async ensureForAcceptedChallenge(challengeId: string): Promise<GamerMatchSessionRecord> {
    const row = await this.database.gamerMatchSession.upsert({
      where: { challengeId },
      create: { challengeId },
      update: {},
      include: sessionInclude,
    });
    return mapSession(row);
  }

  async setRoomCode(matchId: string, roomCode: string): Promise<GamerMatchSessionRecord | null> {
    const updated = await this.database.gamerMatchSession.updateMany({
      where: { id: matchId, status: { in: ["WAITING_FOR_CODE", "IN_PROGRESS"] } },
      data: { roomCode, status: "IN_PROGRESS" },
    });
    if (!updated.count) return null;
    const row = await this.database.gamerMatchSession.findUnique({
      where: { id: matchId },
      include: sessionInclude,
    });
    return row ? mapSession(row) : null;
  }

  async saveSubmission(input: {
    matchId: string;
    side: GamerMatchSide;
    challengerScore: number;
    challengedScore: number;
    proofObjectKey: string;
    proofContentType: string;
    proofSizeBytes: number;
    deadline: Date;
  }): Promise<GamerMatchSessionRecord | null> {
    return this.database.$transaction(async (tx) => {
      const match = await tx.gamerMatchSession.findUnique({ where: { id: input.matchId } });
      if (!match || !["IN_PROGRESS", "PENDING_VERIFICATION"].includes(match.status)) return null;

      await tx.gamerMatchSubmission.upsert({
        where: { matchSessionId_side: { matchSessionId: input.matchId, side: input.side } },
        create: {
          matchSessionId: input.matchId,
          side: input.side,
          challengerScore: input.challengerScore,
          challengedScore: input.challengedScore,
          proofObjectKey: input.proofObjectKey,
          proofContentType: input.proofContentType,
          proofSizeBytes: input.proofSizeBytes,
        },
        update: {
          challengerScore: input.challengerScore,
          challengedScore: input.challengedScore,
          proofObjectKey: input.proofObjectKey,
          proofContentType: input.proofContentType,
          proofSizeBytes: input.proofSizeBytes,
          submittedAt: new Date(),
        },
      });

      await tx.gamerMatchSession.update({
        where: { id: input.matchId },
        data: {
          status: "PENDING_VERIFICATION",
          submissionDeadline: match.submissionDeadline ?? input.deadline,
        },
      });
      const row = await tx.gamerMatchSession.findUnique({
        where: { id: input.matchId },
        include: sessionInclude,
      });
      return row ? mapSession(row) : null;
    });
  }

  async listPendingVerification(limit: number): Promise<GamerMatchSessionRecord[]> {
    const rows = await this.database.gamerMatchSession.findMany({
      where: { status: "PENDING_VERIFICATION" },
      orderBy: [{ submissionDeadline: "asc" }, { updatedAt: "asc" }],
      take: limit,
      include: sessionInclude,
    });
    return rows.map(mapSession);
  }

  async verifyIfPending(input: {
    matchId: string;
    challengerScore: number;
    challengedScore: number;
    winnerSide: GamerMatchSide | null;
    resolution: "MATCHED_SUBMISSIONS" | "SINGLE_SUBMISSION_TIMEOUT";
  }): Promise<boolean> {
    const result = await this.database.gamerMatchSession.updateMany({
      where: { id: input.matchId, status: "PENDING_VERIFICATION" },
      data: {
        status: "VERIFIED",
        finalChallengerScore: input.challengerScore,
        finalChallengedScore: input.challengedScore,
        winnerSide: input.winnerSide,
        resolution: input.resolution,
        resolvedAt: new Date(),
      },
    });
    return result.count === 1;
  }

  async disputeIfPending(matchId: string): Promise<boolean> {
    const result = await this.database.gamerMatchSession.updateMany({
      where: { id: matchId, status: "PENDING_VERIFICATION" },
      data: { status: "DISPUTED" },
    });
    return result.count === 1;
  }

  async listDisputes(): Promise<GamerMatchDisputeRecord[]> {
    const rows = await this.database.gamerMatchSession.findMany({
      where: { status: "DISPUTED" },
      orderBy: { updatedAt: "asc" },
      include: sessionInclude,
    });
    if (!rows.length) return [];
    const challengeIds = rows.map((row) => row.challengeId);
    const challenges = await this.database.gamerChallenge.findMany({
      where: { id: { in: challengeIds } },
      include: {
        game: { select: { id: true, slug: true, name: true } },
        challengerProfile: {
          select: {
            id: true,
            handle: true,
            user: { select: { presentation: { select: presentationSelect } } },
          },
        },
        challengedProfile: {
          select: {
            id: true,
            handle: true,
            user: { select: { presentation: { select: presentationSelect } } },
          },
        },
      },
    });
    const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));
    return rows.flatMap((row) => {
      const challenge = byId.get(row.challengeId);
      const challengerPresentation = challenge?.challengerProfile.user.presentation;
      const challengedPresentation = challenge?.challengedProfile.user.presentation;
      if (!challenge || !challengerPresentation || !challengedPresentation) return [];
      return [
        {
          ...mapSession(row),
          game: challenge.game,
          challenger: {
            id: challenge.challengerProfile.id,
            handle: challenge.challengerProfile.handle,
            presentation: challengerPresentation,
          },
          challenged: {
            id: challenge.challengedProfile.id,
            handle: challenge.challengedProfile.handle,
            presentation: challengedPresentation,
          },
        },
      ];
    });
  }

  async resolveDispute(input: {
    matchId: string;
    actorUserId: string;
    resolution: GamerDisputeResolutionInput;
  }): Promise<GamerMatchSessionRecord | null> {
    return this.database.$transaction(async (tx) => {
      const match = await tx.gamerMatchSession.findUnique({ where: { id: input.matchId } });
      if (!match || match.status !== "DISPUTED") return null;
      const score = input.resolution.decision === "SCORE" ? input.resolution : null;
      await tx.gamerMatchSession.update({
        where: { id: input.matchId },
        data: score
          ? {
              status: "VERIFIED",
              finalChallengerScore: score.challengerScore,
              finalChallengedScore: score.challengedScore,
              winnerSide: winnerSide(score.challengerScore, score.challengedScore),
              resolution: "PLATFORM_ADMIN",
              resolvedAt: new Date(),
              moderatorNotes: score.moderatorNotes,
            }
          : {
              status: "VOIDED",
              finalChallengerScore: null,
              finalChallengedScore: null,
              winnerSide: null,
              resolution: "PLATFORM_ADMIN_VOID",
              resolvedAt: new Date(),
              moderatorNotes: input.resolution.moderatorNotes,
            },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: score ? "GAMER_MATCH_DISPUTE_RESOLVED" : "GAMER_MATCH_DISPUTE_VOIDED",
          entityType: "GamerMatchSession",
          entityId: input.matchId,
          metadata: {
            challengeId: match.challengeId,
            decision: input.resolution.decision,
            ...(score
              ? {
                  challengerScore: score.challengerScore,
                  challengedScore: score.challengedScore,
                }
              : {}),
            moderatorNotes: input.resolution.moderatorNotes,
          },
        },
      });
      const row = await tx.gamerMatchSession.findUnique({
        where: { id: input.matchId },
        include: sessionInclude,
      });
      return row ? mapSession(row) : null;
    });
  }

  async getSubmissionProof(
    matchId: string,
    side: GamerMatchSide,
  ): Promise<GamerMatchSubmissionRecord | null> {
    const row = await this.database.gamerMatchSubmission.findUnique({
      where: { matchSessionId_side: { matchSessionId: matchId, side } },
      select: submissionSelect,
    });
    return row ? mapSubmission(row) : null;
  }
}
