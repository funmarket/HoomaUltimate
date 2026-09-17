import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  HelpRequestCreateInput,
  HelpRequestListQuery,
  HelpRequestStatus,
} from "@hooma/contracts/requests";
import type {
  HelpRequestPage,
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../application/request.repository.js";

const helpRequestSelect = Prisma.validator<Prisma.HelpRequestSelect>()({
  id: true,
  createdByUserId: true,
  publisherCommunityId: true,
  publisherTeamId: true,
  publisherAthletesCommunityId: true,
  audienceScope: true,
  audienceCommunityId: true,
  audienceAthletesCommunityId: true,
  category: true,
  itemKind: true,
  sport: true,
  title: true,
  description: true,
  quantityNeeded: true,
  sizeLabel: true,
  conditionPreference: true,
  placeId: true,
  city: true,
  houma: true,
  locationNote: true,
  neededByAt: true,
  expiresAt: true,
  status: true,
  fulfilledAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
});

type HelpRequestRow = Prisma.HelpRequestGetPayload<{ select: typeof helpRequestSelect }>;

const publicStatuses: readonly HelpRequestStatus[] = ["OPEN", "IN_PROGRESS", "FULFILLED"];

function record(row: HelpRequestRow): HelpRequestRecord {
  return row;
}

function filters(input: HelpRequestListQuery): Prisma.HelpRequestWhereInput {
  return {
    ...(input.category ? { category: input.category } : {}),
    ...(input.sport ? { sport: input.sport } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.houma ? { houma: input.houma } : {}),
  };
}

function page(rows: readonly HelpRequestRow[], limit: number): HelpRequestPage {
  const items = rows.slice(0, limit);
  return {
    items: items.map(record),
    nextCursor: rows.length > limit ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export class PrismaRequestRepository implements RequestRepository, RequestVisibilityReader {
  constructor(private readonly db: PrismaClient) {}

  async create(
    createdByUserId: string,
    input: HelpRequestCreateInput,
  ): Promise<HelpRequestRecord> {
    const audienceCommunityId =
      input.audience.scope === "HOOMA_COMMUNITY" ? input.audience.communityId : null;
    const audienceAthletesCommunityId =
      input.audience.scope === "ATHLETES_COMMUNITY" ? input.audience.athletesCommunityId : null;

    return record(
      await this.db.helpRequest.create({
        data: {
          createdByUserId,
          publisherCommunityId: input.publisher.publisherCommunityId ?? null,
          publisherTeamId: input.publisher.publisherTeamId ?? null,
          publisherAthletesCommunityId: input.publisher.publisherAthletesCommunityId ?? null,
          audienceScope: input.audience.scope,
          audienceCommunityId,
          audienceAthletesCommunityId,
          category: input.category,
          itemKind: input.itemKind ?? null,
          sport: input.sport ?? null,
          title: input.title,
          description: input.description,
          quantityNeeded: input.quantityNeeded ?? null,
          sizeLabel: input.sizeLabel ?? null,
          conditionPreference: input.conditionPreference ?? null,
          placeId: input.placeId ?? null,
          city: input.city ?? null,
          houma: input.houma ?? null,
          locationNote: input.locationNote ?? null,
          neededByAt: input.neededByAt ? new Date(input.neededByAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
        select: helpRequestSelect,
      }),
    );
  }

  async listPublic(input: HelpRequestListQuery): Promise<HelpRequestPage> {
    const allowedStatuses = input.status
      ? publicStatuses.includes(input.status)
        ? [input.status]
        : []
      : publicStatuses;
    const rows = await this.db.helpRequest.findMany({
      where: {
        ...filters(input),
        audienceScope: "PUBLIC",
        status: { in: allowedStatuses },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: helpRequestSelect,
    });
    return page(rows, input.limit);
  }

  async getPublic(id: string): Promise<HelpRequestRecord | null> {
    const row = await this.db.helpRequest.findFirst({
      where: { id, audienceScope: "PUBLIC", status: { in: [...publicStatuses] } },
      select: helpRequestSelect,
    });
    return row ? record(row) : null;
  }

  async listVisibleToMember(userId: string, input: HelpRequestListQuery): Promise<HelpRequestPage> {
    const [communityIds, athletesCommunityIds] = await Promise.all([
      this.activeCommunityIds(userId),
      this.activeAthletesCommunityIds(userId),
    ]);
    const rows = await this.db.helpRequest.findMany({
      where: {
        ...filters(input),
        ...(input.status ? { status: input.status } : {}),
        OR: [
          { createdByUserId: userId },
          { audienceScope: "PUBLIC" },
          {
            audienceScope: "HOOMA_COMMUNITY",
            audienceCommunityId: { in: communityIds },
          },
          {
            audienceScope: "ATHLETES_COMMUNITY",
            audienceAthletesCommunityId: { in: athletesCommunityIds },
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: helpRequestSelect,
    });
    return page(rows, input.limit);
  }

  async getVisibleToMember(userId: string, id: string): Promise<HelpRequestRecord | null> {
    const [communityIds, athletesCommunityIds] = await Promise.all([
      this.activeCommunityIds(userId),
      this.activeAthletesCommunityIds(userId),
    ]);
    const row = await this.db.helpRequest.findFirst({
      where: {
        id,
        OR: [
          { createdByUserId: userId },
          { audienceScope: "PUBLIC" },
          {
            audienceScope: "HOOMA_COMMUNITY",
            audienceCommunityId: { in: communityIds },
          },
          {
            audienceScope: "ATHLETES_COMMUNITY",
            audienceAthletesCommunityId: { in: athletesCommunityIds },
          },
        ],
      },
      select: helpRequestSelect,
    });
    return row ? record(row) : null;
  }

  async communityRole(communityId: string, userId: string) {
    const membership = await this.db.communityMembership.findFirst({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async teamResponsibility(teamId: string, userId: string) {
    const assignments = await this.db.teamResponsibilityAssignment.findMany({
      where: { teamId, userId, revokedAt: null, team: { status: "ACTIVE" } },
      select: { role: true },
    });
    if (assignments.some((assignment) => assignment.role === "COACH")) return "COACH" as const;
    if (assignments.some((assignment) => assignment.role === "ASSISTANT")) return "ASSISTANT" as const;
    return null;
  }

  async athletesRole(athletesCommunityId: string, userId: string) {
    const membership = await this.db.athletesMembership.findFirst({
      where: {
        athletesCommunityId,
        userId,
        leftAt: null,
        athletesCommunity: { status: "ACTIVE" },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async isCommunityMember(communityId: string, userId: string): Promise<boolean> {
    return Boolean(await this.communityRole(communityId, userId));
  }

  async isAthletesMember(athletesCommunityId: string, userId: string): Promise<boolean> {
    return Boolean(await this.athletesRole(athletesCommunityId, userId));
  }

  private async activeCommunityIds(userId: string): Promise<string[]> {
    const memberships = await this.db.communityMembership.findMany({
      where: { userId, leftAt: null, community: { status: "ACTIVE" } },
      select: { communityId: true },
    });
    return memberships.map((membership) => membership.communityId);
  }

  private async activeAthletesCommunityIds(userId: string): Promise<string[]> {
    const memberships = await this.db.athletesMembership.findMany({
      where: { userId, leftAt: null, athletesCommunity: { status: "ACTIVE" } },
      select: { athletesCommunityId: true },
    });
    return memberships.map((membership) => membership.athletesCommunityId);
  }
}
