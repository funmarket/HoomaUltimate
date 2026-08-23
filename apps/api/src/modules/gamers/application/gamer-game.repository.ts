export type GamerGameStatus = "ACTIVE" | "INACTIVE";

export type GamerGameSummary = {
  id: string;
  slug: string;
  name: string;
  status: GamerGameStatus;
};

/**
 * Canonical Gamers game-catalog persistence port.
 *
 * G0 preserves the useful layering from the retired catalog experiment without
 * preserving its hardcoded bootstrap catalog. G1 will provide the PostgreSQL /
 * Prisma implementation and expand this port for authenticated game creation.
 */
export interface GamerGameRepository {
  listActive(): Promise<GamerGameSummary[]>;
  getActive(slug: string): Promise<GamerGameSummary | null>;
}
