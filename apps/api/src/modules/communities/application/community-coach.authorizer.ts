export interface CommunityCoachAuthorizer {
  requireCoach(communityId: string, userId: string): Promise<void>;
}
