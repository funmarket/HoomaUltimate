import type { PrismaClient } from "@hooma/database";
import type {
  GamerChallengerSummary,
  GamerProfileRecord,
  GamerProfileRepository,
  GamerPublicProfile,
} from "../application/gamer-profile.repository.js";

const profileSelect = {
  id: true,
  userId: true,
  gameId: true,
  handle: true,
  openToChallenge: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaGamerProfileRepository implements GamerProfileRepository {
  constructor(private readonly db: PrismaClient) {}

  getByUserAndGame(userId: string, gameId: string): Promise<GamerProfileRecord | null> {
    return this.db.gamerProfile.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: profileSelect,
    });
  }

  getById(profileId: string): Promise<GamerProfileRecord | null> {
    return this.db.gamerProfile.findUnique({ where: { id: profileId }, select: profileSelect });
  }

  async getPublicByGameAndId(
    gameId: string,
    profileId: string,
  ): Promise<GamerPublicProfile | null> {
    const row = await this.db.gamerProfile.findFirst({
      where: { id: profileId, gameId },
      select: {
        id: true,
        handle: true,
        openToChallenge: true,
        user: {
          select: {
            presentation: {
              select: { username: true, displayName: true, photoUrl: true, bio: true },
            },
          },
        },
      },
    });
    if (!row?.user.presentation) return null;
    return {
      id: row.id,
      handle: row.handle,
      openToChallenge: row.openToChallenge,
      presentation: row.user.presentation,
    };
  }

  async listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]> {
    const rows = await this.db.gamerProfile.findMany({
      where: { gameId, openToChallenge: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
    });

    return rows.flatMap((row) =>
      row.user.presentation
        ? [{ id: row.id, handle: row.handle, presentation: row.user.presentation }]
        : [],
    );
  }

  upsert(input: {
    userId: string;
    gameId: string;
    handle: string;
    openToChallenge: boolean;
  }): Promise<GamerProfileRecord> {
    return this.db.gamerProfile.upsert({
      where: { userId_gameId: { userId: input.userId, gameId: input.gameId } },
      create: input,
      update: { handle: input.handle, openToChallenge: input.openToChallenge },
      select: profileSelect,
    });
  }
}
