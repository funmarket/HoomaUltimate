export interface CommunityCreateInput {
  name: string;
  description?: string | null;
  city?: string | null;
  houma?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

export interface CommunityRepository {
  listPublic(limit: number, cursor?: string): Promise<unknown>;
  getPublic(id: string): Promise<unknown | null>;
  create(userId: string, input: CommunityCreateInput): Promise<unknown>;
  managerRole(communityId: string, userId: string): Promise<"FOUNDER" | "COACH" | "MEMBER" | null>;
  appointCoach(communityId: string, targetUserId: string): Promise<void>;
  revokeCoach(communityId: string, targetUserId: string): Promise<void>;
}
