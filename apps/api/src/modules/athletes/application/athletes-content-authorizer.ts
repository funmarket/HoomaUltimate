export interface AthletesMemberContentAuthorizer {
  requireMemberContent(userId: string, athletesCommunityId: string): Promise<void>;
}

export interface AthletesFounderContentAuthorizer {
  requireFounderContent(userId: string, athletesCommunityId: string): Promise<void>;
}

export type AthletesContentAuthorizer = AthletesMemberContentAuthorizer &
  AthletesFounderContentAuthorizer;
