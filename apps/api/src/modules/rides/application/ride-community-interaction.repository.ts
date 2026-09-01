export interface RideCommunityInteractionRecord {
  readonly requesterUserId: string;
}

export interface RideCommunityInteractionRepository {
  getActiveCommunityRequest(input: {
    readonly communityId: string;
    readonly requestId: string;
  }): Promise<RideCommunityInteractionRecord | null>;
}
