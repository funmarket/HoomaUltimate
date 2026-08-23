export type GamerProfileRecord = {
  id: string;
  userId: string;
  gameId: string;
  handle: string;
  openToChallenge: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GamerChallengerSummary = GamerProfileRecord & {
  presentation: {
    username: string;
    displayName: string;
    photoUrl: string | null;
  };
};

export interface GamerProfileRepository {
  getByUserAndGame(userId: string, gameId: string): Promise<GamerProfileRecord | null>;
  listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]>;
  upsert(input: {
    userId: string;
    gameId: string;
    handle: string;
    openToChallenge: boolean;
  }): Promise<GamerProfileRecord>;
}
