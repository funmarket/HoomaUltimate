export type GamerGameStatus = "ACTIVE" | "INACTIVE";

export type GamerGameSummary = {
  id: string;
  slug: string;
  name: string;
  status: GamerGameStatus;
};

export interface GamerGameRepository {
  listActive(): Promise<GamerGameSummary[]>;
  getActive(slug: string): Promise<GamerGameSummary | null>;
}
