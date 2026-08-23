export type GamerGameStatus = "ACTIVE" | "INACTIVE";

export type GamerGameSummary = {
  id: string;
  slug: string;
  name: string;
  status: GamerGameStatus;
};

export type GamerGameCreate = {
  name: string;
  normalizedName: string;
  slug: string;
  createdByUserId: string;
};

export interface GamerGameRepository {
  listActive(): Promise<GamerGameSummary[]>;
  getActive(slug: string): Promise<GamerGameSummary | null>;
  getActiveById(id: string): Promise<GamerGameSummary | null>;
  getByNormalizedName(normalizedName: string): Promise<GamerGameSummary | null>;
  create(input: GamerGameCreate): Promise<GamerGameSummary | null>;
}
