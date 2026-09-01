import type {
  AthletesCommunityCreateInput,
  AthletesCommunityUpdateInput,
  AthletesJoinPolicy,
  AthletesJoinRequestStatus,
  AthletesRole,
  AthletesSport,
  AthletesVisibility,
} from "@hooma/contracts/athletes";

export type { AthletesRole };

export interface AthletesCommunityRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sport: AthletesSport;
  readonly description: string | null;
  readonly city: string | null;
  readonly houma: string | null;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly visibility: AthletesVisibility;
  readonly joinPolicy: AthletesJoinPolicy;
  readonly status: "ACTIVE" | "ARCHIVED";
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AthletesMembershipRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly userId: string;
  readonly role: AthletesRole;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export interface AthletesJoinRequestRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly userId: string;
  readonly status: AthletesJoinRequestStatus;
  readonly requestedAt: Date;
  readonly resolvedAt: Date | null;
  readonly resolvedByUserId: string | null;
}

export interface AthletesMemberRecord {
  readonly userId: string;
  readonly role: AthletesRole;
  readonly joinedAt: Date;
  readonly presentation: {
    readonly displayName: string;
    readonly username: string;
    readonly photoUrl: string | null;
  } | null;
}

export interface AthletesJoinRequestManagerRecord extends AthletesJoinRequestRecord {
  readonly requester: { readonly presentation: AthletesMemberRecord["presentation"] };
}

export interface AthletesPublicListInput {
  readonly sport?: AthletesSport;
  readonly cursor?: string;
  readonly limit: number;
}

export interface AthletesCreateRecordInput extends AthletesCommunityCreateInput {
  readonly joinPolicy: AthletesJoinPolicy;
}

export interface AthletesRepository {
  listPublic(
    input: AthletesPublicListInput,
  ): Promise<{ items: unknown[]; nextCursor: string | null }>;
  getPublic(id: string): Promise<unknown | null>;
  createWithFounder(
    userId: string,
    input: AthletesCreateRecordInput,
  ): Promise<AthletesCommunityRecord>;
  update(id: string, input: AthletesCommunityUpdateInput): Promise<AthletesCommunityRecord>;
  archive(id: string): Promise<boolean>;
  lifecycle(id: string): Promise<AthletesCommunityRecord | null>;
  managerRole(id: string, userId: string): Promise<AthletesRole | null>;
  activeRole(id: string, userId: string): Promise<AthletesRole | null>;
  joinOpen(id: string, userId: string): Promise<AthletesMembershipRecord>;
  requestJoin(
    id: string,
    userId: string,
  ): Promise<
    | { kind: "REQUEST"; request: AthletesJoinRequestRecord }
    | { kind: "MEMBERSHIP"; role: AthletesRole }
  >;
  getJoinRequest(id: string, userId: string): Promise<AthletesJoinRequestRecord | null>;
  cancelJoinRequest(id: string, userId: string): Promise<boolean>;
  listJoinRequests(id: string): Promise<AthletesJoinRequestManagerRecord[]>;
  resolveJoinRequest(
    id: string,
    targetUserId: string,
    resolverUserId: string,
    decision: "APPROVE" | "DECLINE",
  ): Promise<boolean>;
  listMembers(id: string): Promise<AthletesMemberRecord[]>;
  addMemberByUsername(
    id: string,
    username: string,
    resolverUserId: string,
  ): Promise<{ userId: string; username: string } | null>;
  removeMember(id: string, targetUserId: string): Promise<boolean>;
  setRole(id: string, targetUserId: string, role: "MODERATOR" | "MEMBER"): Promise<boolean>;
}
