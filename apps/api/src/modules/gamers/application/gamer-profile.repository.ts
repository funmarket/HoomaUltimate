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
  bio: string | null;
};

export type GamerPublicProfile = {
  id: string;
  handle: string;
  openToChallenge: boolean;
  presentation: GamerPublicPresentation;
};

export type GamerChallengerSummary = {
  id: string;
  handle: string;
  presentation: Omit<GamerPublicPresentation, "bio">;
};

export interface GamerProfileRepository {
  getByUserAndGame(userId: string, gameId: string): Promise<GamerProfileRecord | null>;
  getById(profileId: string): Promise<GamerProfileRecord | null>;
  getPublicByGameAndId(gameId: string, profileId: string): Promise<GamerPublicProfile | null>;
  listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]>;
  upsert(input: {
    userId: string;
    gameId: string;
    handle: string;
    openToChallenge: boolean;
  }): Promise<GamerProfileRecord>;
}
