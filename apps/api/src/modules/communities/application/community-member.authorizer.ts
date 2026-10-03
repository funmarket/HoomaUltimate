export interface CommunityMemberAuthorizer {
  requireMember(communityId: string, userId: string): Promise<void>;
}
