import type {
  HelpRequestCreateInput,
  HelpRequestListQuery,
  HelpRequestStatus,
  RequestConditionPreference,
} from "@hooma/contracts/requests";
import type { HelpAudienceScope, HelpCategory, HelpItemKind } from "@hooma/contracts/help";
import type { AthletesSport } from "@hooma/contracts/athletes";

export interface HelpRequestRecord {
  readonly id: string;
  readonly createdByUserId: string;
  readonly publisherCommunityId: string | null;
  readonly publisherTeamId: string | null;
  readonly publisherAthletesCommunityId: string | null;
  readonly audienceScope: HelpAudienceScope;
  readonly audienceCommunityId: string | null;
  readonly audienceAthletesCommunityId: string | null;
  readonly category: HelpCategory;
  readonly itemKind: HelpItemKind | null;
  readonly sport: AthletesSport | null;
  readonly title: string;
  readonly description: string;
  readonly quantityNeeded: number | null;
  readonly sizeLabel: string | null;
  readonly conditionPreference: RequestConditionPreference | null;
  readonly placeId: string | null;
  readonly city: string | null;
  readonly houma: string | null;
  readonly locationNote: string | null;
  readonly neededByAt: Date | null;
  readonly expiresAt: Date | null;
  readonly status: HelpRequestStatus;
  readonly fulfilledAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface HelpRequestPage {
  readonly items: readonly HelpRequestRecord[];
  readonly nextCursor: string | null;
}

export interface RequestRepository {
  create(createdByUserId: string, input: HelpRequestCreateInput): Promise<HelpRequestRecord>;
  listPublic(input: HelpRequestListQuery): Promise<HelpRequestPage>;
  getPublic(id: string): Promise<HelpRequestRecord | null>;
  listVisibleToMember(userId: string, input: HelpRequestListQuery): Promise<HelpRequestPage>;
  getVisibleToMember(userId: string, id: string): Promise<HelpRequestRecord | null>;
}

export interface RequestVisibilityReader {
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
