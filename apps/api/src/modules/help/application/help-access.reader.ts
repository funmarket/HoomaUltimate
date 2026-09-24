export interface HelpAccessReader {
  communityRole(
    communityId: string,
    userId: string,
  ): Promise<"FOUNDER" | "COACH" | "MEMBER" | null>;
  teamResponsibility(teamId: string, userId: string): Promise<"COACH" | "ASSISTANT" | null>;
  athletesRole(
    athletesCommunityId: string,
    userId: string,
  ): Promise<"FOUNDER" | "MODERATOR" | "MEMBER" | null>;
  isCommunityMember(communityId: string, userId: string): Promise<boolean>;
  isAthletesMember(athletesCommunityId: string, userId: string): Promise<boolean>;
}
