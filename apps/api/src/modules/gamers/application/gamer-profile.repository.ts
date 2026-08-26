export type GamerProfileRecord = {
  id: string;
  userId: string;
  gameId: string;
  handle: string;
  openToChallenge: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GamerPublicPresentation = {
  username: string;
  displayName: string;
  photoUrl: string | null;
};

export type GamerChallengerSummary = {
  id: string;
  handle: string;
  presentation: GamerPublicPresentation;
};

export type GamerDiscoverySummary = {
  id: string;
  handle: string;
  openToChallenge: boolean;
  game: {
    id: string;
    slug: string;
    name: string;
  };
  presentation: GamerPublicPresentation;
};

export interface GamerProfileRepository {
  getByUserAndGame(userId: string, gameId: string): Promise<GamerProfileRecord | null>;
  getById(profileId: string): Promise<GamerProfileRecord | null>;
  listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]>;
  listDiscoverable(): Promise<GamerDiscoverySummary[]>;
  upsert(input: {
    userId: string;
    gameId: string;
    handle: string;
    openToChallenge: boolean;
  }): Promise<GamerProfileRecord>;
}
