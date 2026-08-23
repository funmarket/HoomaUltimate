export type CommunityRole = "FOUNDER" | "COACH" | "MEMBER";

export interface CommunityCreateInput {
  name: string;
  description?: string | null;
  city?: string | null;
  houma?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

export interface CommunityMember {
  userId: string;
  role: CommunityRole;
  joinedAt: Date;
  presentation: {
    displayName: string;
    username: string;
    photoUrl: string | null;
  } | null;
}

export interface CommunityRepository {
  listPublic(limit: number, cursor?: string): Promise<unknown>;
  getPublic(id: string): Promise<unknown | null>;
  create(userId: string, input: CommunityCreateInput): Promise<unknown>;
  managerRole(communityId: string, userId: string): Promise<CommunityRole | null>;
  join(communityId: string, userId: string): Promise<{ role: CommunityRole } | null>;
  leave(communityId: string, userId: string): Promise<void>;
  listMembers(communityId: string): Promise<CommunityMember[]>;
  removeMember(communityId: string, targetUserId: string): Promise<void>;
  appointCoach(communityId: string, targetUserId: string): Promise<void>;
  revokeCoach(communityId: string, targetUserId: string): Promise<void>;
}
