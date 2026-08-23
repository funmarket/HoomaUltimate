import type { PrismaClient } from "@hooma/database";
import type {
  GamerGameCreate,
  GamerGameRepository,
  GamerGameSummary,
} from "../application/gamer-game.repository.js";

const gameSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class PrismaGamerGameRepository implements GamerGameRepository {
  constructor(private readonly db: PrismaClient) {}

  listActive(): Promise<GamerGameSummary[]> {
    return this.db.gamerGame.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: gameSelect,
    });
  }

  getActive(slug: string): Promise<GamerGameSummary | null> {
    return this.db.gamerGame.findFirst({
      where: { slug, status: "ACTIVE" },
      select: gameSelect,
    });
  }

  getActiveById(id: string): Promise<GamerGameSummary | null> {
    return this.db.gamerGame.findFirst({
      where: { id, status: "ACTIVE" },
      select: gameSelect,
    });
  }

  getByNormalizedName(normalizedName: string): Promise<GamerGameSummary | null> {
    return this.db.gamerGame.findUnique({
      where: { normalizedName },
      select: gameSelect,
    });
  }

  async create(input: GamerGameCreate): Promise<GamerGameSummary | null> {
    try {
      return await this.db.gamerGame.create({
        data: input,
        select: gameSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }
}
