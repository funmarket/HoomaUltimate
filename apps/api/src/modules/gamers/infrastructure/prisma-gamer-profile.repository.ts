import type { PrismaClient } from "@hooma/database";
import type {
  GamerChallengerSummary,
  GamerProfileRecord,
  GamerProfileRepository,
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

  async listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]> {
    const rows = await this.db.gamerProfile.findMany({
      where: { gameId, openToChallenge: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        ...profileSelect,
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
      row.user.presentation ? [{ ...row, presentation: row.user.presentation }] : [],
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
