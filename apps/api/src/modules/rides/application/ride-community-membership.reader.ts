export interface RideCommunitySummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface RideCommunityMembershipReader {
  listActiveMembershipCommunities(userId: string): Promise<RideCommunitySummary[]>;
  isActiveMemberOfCommunity(userId: string, communityId: string): Promise<boolean>;
}
