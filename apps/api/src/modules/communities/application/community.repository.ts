import type {
  CommunityCreateInput,
  CommunityJoinPolicy,
  CommunityJoinRequestStatus,
  CommunityRole,
  CommunityUpdateInput,
  CommunityVisibility,
} from "@hooma/contracts/communities";

export type { CommunityRole } from "@hooma/contracts/communities";

export interface CommunityCreateRecordInput extends CommunityCreateInput {
  joinPolicy: CommunityJoinPolicy;
}

export interface CommunityUpdateRecordInput extends CommunityUpdateInput {
  joinPolicy?: CommunityJoinPolicy;
}

export interface CommunityLifecycleRecord {
  readonly createdByUserId: string;
  readonly status: "ACTIVE" | "ARCHIVED";
  readonly visibility: CommunityVisibility;
  readonly joinPolicy: CommunityJoinPolicy;
  readonly hasActiveTeam: boolean;
  readonly hasPublishedEvent: boolean;
}

export interface CommunityMembershipPolicyRecord {
  readonly status: "ACTIVE" | "ARCHIVED";
  readonly visibility: CommunityVisibility;
  readonly joinPolicy: CommunityJoinPolicy;
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

export interface CommunityJoinRequestRecord {
  id: string;
  communityId: string;
  userId: string;
  status: CommunityJoinRequestStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
}

export interface CommunityJoinRequestForFounderRecord extends CommunityJoinRequestRecord {
  presentation: {
    displayName: string;
    username: string;
    photoUrl: string | null;
  } | null;
}

export type CommunityPrivateJoinOutcome =
  | { kind: "MEMBERSHIP"; role: CommunityRole }
  | { kind: "REQUEST"; request: CommunityJoinRequestRecord };

export interface CommunityRepository {
  listPublic(limit: number, cursor?: string): Promise<unknown>;
  getPublic(id: string): Promise<unknown | null>;
  create(userId: string, input: CommunityCreateRecordInput): Promise<unknown>;
  lifecycle(communityId: string): Promise<CommunityLifecycleRecord | null>;
  membershipPolicy(communityId: string): Promise<CommunityMembershipPolicyRecord | null>;
  update(communityId: string, input: CommunityUpdateRecordInput): Promise<unknown>;
  archive(communityId: string): Promise<void>;
  managerRole(communityId: string, userId: string): Promise<CommunityRole | null>;
  joinOpen(communityId: string, userId: string): Promise<{ role: CommunityRole } | null>;
  requestJoin(communityId: string, userId: string): Promise<CommunityPrivateJoinOutcome | null>;
  getJoinRequest(
    communityId: string,
    userId: string,
  ): Promise<CommunityJoinRequestRecord | null>;
  listJoinRequests(communityId: string): Promise<CommunityJoinRequestForFounderRecord[]>;
  resolveJoinRequest(
    communityId: string,
    targetUserId: string,
    resolverUserId: string,
    decision: "APPROVE" | "DECLINE",
  ): Promise<boolean>;
  cancelJoinRequest(communityId: string, userId: string): Promise<boolean>;
  addMemberByUsername(
    communityId: string,
    username: string,
    resolverUserId: string,
  ): Promise<{ userId: string; username: string } | null>;
  leave(communityId: string, userId: string): Promise<void>;
  listMembers(communityId: string): Promise<CommunityMember[]>;
  removeMember(communityId: string, targetUserId: string): Promise<void>;
  appointCoach(communityId: string, targetUserId: string): Promise<void>;
  revokeCoach(communityId: string, targetUserId: string): Promise<void>;
}
