import type { PrismaClient } from "@hooma/database";
import type {
  GamerChallengeRecord,
  GamerChallengeRepository,
  GamerChallengeStatus,
} from "../application/gamer-challenge.repository.js";

const challengeSelect = {
  id: true,
  gameId: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  cancelledAt: true,
  challengerProfile: {
    select: {
      id: true,
      handle: true,
      user: {
        select: {
          presentation: {
            select: { username: true, displayName: true, photoUrl: true },
          },
        },
      },
    },
  },
  challengedProfile: {
    select: {
      id: true,
      handle: true,
      user: {
        select: {
          presentation: {
            select: { username: true, displayName: true, photoUrl: true },
          },
        },
      },
    },
  },
} as const;

type SelectedChallenge = {
  id: string;
  gameId: string;
  status: GamerChallengeStatus;
  createdAt: Date;
  respondedAt: Date | null;
  cancelledAt: Date | null;
  challengerProfile: {
    id: string;
    handle: string;
    user: { presentation: { username: string; displayName: string; photoUrl: string | null } | null };
  };
  challengedProfile: {
    id: string;
    handle: string;
    user: { presentation: { username: string; displayName: string; photoUrl: string | null } | null };
  };
};

function mapChallenge(row: SelectedChallenge): GamerChallengeRecord | null {
  const challengerPresentation = row.challengerProfile.user.presentation;
  const challengedPresentation = row.challengedProfile.user.presentation;
  if (!challengerPresentation || !challengedPresentation) return null;
  return {
    id: row.id,
    gameId: row.gameId,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    cancelledAt: row.cancelledAt,
    challenger: {
      id: row.challengerProfile.id,
      handle: row.challengerProfile.handle,
      presentation: challengerPresentation,
    },
    challenged: {
      id: row.challengedProfile.id,
      handle: row.challengedProfile.handle,
      presentation: challengedPresentation,
    },
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export class PrismaGamerChallengeRepository implements GamerChallengeRepository {
  constructor(private readonly db: PrismaClient) {}

  async createPending(input: {
    gameId: string;
    challengerProfileId: string;
    challengedProfileId: string;
    pairKey: string;
  }): Promise<GamerChallengeRecord | null> {
    try {
      const row = (await this.db.gamerChallenge.create({
        data: input,
        select: challengeSelect,
      })) as SelectedChallenge;
      return mapChallenge(row);
    } catch (error) {
      if (isUniqueConstraint(error)) return null;
      throw error;
    }
  }

  async listForUserAndGame(userId: string, gameId: string): Promise<GamerChallengeRecord[]> {
    const rows = (await this.db.gamerChallenge.findMany({
      where: {
        gameId,
        OR: [
          { challengerProfile: { userId } },
          { challengedProfile: { userId } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: challengeSelect,
    })) as SelectedChallenge[];
    return rows.flatMap((row) => {
      const mapped = mapChallenge(row);
      return mapped ? [mapped] : [];
    });
  }

  acceptForChallengedUser(challengeId: string, userId: string) {
    return this.transitionForChallengedUser(challengeId, userId, "ACCEPTED");
  }

  declineForChallengedUser(challengeId: string, userId: string) {
    return this.transitionForChallengedUser(challengeId, userId, "DECLINED");
  }

  async cancelForChallengerUser(
    challengeId: string,
    userId: string,
  ): Promise<GamerChallengeRecord | null> {
    const existing = (await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challengerProfile: { userId } },
      select: challengeSelect,
    })) as SelectedChallenge | null;
    if (!existing) return null;
    if (existing.status === "CANCELLED") return mapChallenge(existing);
    if (existing.status !== "PENDING") return null;

    await this.db.gamerChallenge.updateMany({
      where: { id: challengeId, status: "PENDING", challengerProfile: { userId } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    const updated = (await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challengerProfile: { userId } },
      select: challengeSelect,
    })) as SelectedChallenge | null;
    return updated?.status === "CANCELLED" ? mapChallenge(updated) : null;
  }

  private async transitionForChallengedUser(
    challengeId: string,
    userId: string,
    nextStatus: "ACCEPTED" | "DECLINED",
  ): Promise<GamerChallengeRecord | null> {
    const existing = (await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challengedProfile: { userId } },
      select: challengeSelect,
    })) as SelectedChallenge | null;
    if (!existing) return null;
    if (existing.status === nextStatus) return mapChallenge(existing);
    if (existing.status !== "PENDING") return null;

    await this.db.gamerChallenge.updateMany({
      where: { id: challengeId, status: "PENDING", challengedProfile: { userId } },
      data: { status: nextStatus, respondedAt: new Date() },
    });
    const updated = (await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challengedProfile: { userId } },
      select: challengeSelect,
    })) as SelectedChallenge | null;
    return updated?.status === nextStatus ? mapChallenge(updated) : null;
  }
}
