export type WhistleContextType =
  "COMMUNITY" | "EVENT" | "TEAM" | "RIDE" | "ULTRAS" | "GAMER_SQUAD" | "GAMER_DIRECT";

export type WhistleAuthorPresentation = {
  displayName: string;
  username: string;
  photoUrl: string | null;
};

export type WhistleMetadataRecord = {
  id: string;
  authorUserId: string;
  contextType: WhistleContextType;
  contextId: string;
  createdAt: Date;
  expiresAt: Date;
  author?: { presentation: WhistleAuthorPresentation | null };
};

export interface WhistleRepository {
  createWithDailyQuota(input: {
    id: string;
    authorUserId: string;
    contextType: WhistleContextType;
    contextId: string;
    createdAt: Date;
    expiresAt: Date;
    dayKey: string;
    dailyLimit: number;
  }): Promise<WhistleMetadataRecord | null>;
  quotaUsed(userId: string, dayKey: string): Promise<number>;
  listActive(
    contextType: WhistleContextType,
    contextId: string,
    now: Date,
    limit: number,
  ): Promise<WhistleMetadataRecord[]>;
  deleteExpired(now: Date): Promise<number>;
}
