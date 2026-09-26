import { expireDueHelpRequests, Prisma, type PrismaClient } from "@hooma/database";
import type {
  HelpRequestImageSource,
  HelpRequestListQuery,
  HelpRequestStatus,
  RequestImageContentType,
} from "@hooma/contracts/requests";
import type {
  HelpRequestCreatePersistenceInput,
  HelpRequestPage,
  HelpRequestRecord,
  HelpRequestResponseRecord,
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
  requestType: true,
  sport: true,
  subcategoryId: true,
  needId: true,
  customNeed: true,
  taxonomySubcategory: {
    select: { id: true, slug: true, label: true },
  },
  taxonomyNeed: {
    select: { id: true, slug: true, label: true, kind: true, allowsCustomText: true },
  },
  title: true,
  description: true,
  quantityNeeded: true,
  sizeLabel: true,
  conditionPreference: true,
  placeId: true,
  city: true,
  houma: true,
  fullAddress: true,
  locationNote: true,
  image: {
    select: {
      id: true,
      source: true,
      contentType: true,
      sizeBytes: true,
      updatedAt: true,
    },
  },
  neededByAt: true,
  expiresAt: true,
  status: true,
  fulfilledAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
});

const helpRequestResponseSelect = Prisma.validator<Prisma.HelpRequestResponseSelect>()({
  id: true,
  requestId: true,
  responderUserId: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
  declinedAt: true,
  withdrawnAt: true,
});

type HelpRequestRow = Prisma.HelpRequestGetPayload<{ select: typeof helpRequestSelect }>;
type HelpRequestResponseRow = Prisma.HelpRequestResponseGetPayload<{
  select: typeof helpRequestResponseSelect;
}>;

const publicStatuses: HelpRequestStatus[] = ["OPEN", "IN_PROGRESS", "FULFILLED"];

class RequestMutationConflict extends Error {}

function record(row: HelpRequestRow): HelpRequestRecord {
  return {
    ...row,
    image: row.image
      ? {
          ...row.image,
          source: row.image.source as HelpRequestImageSource,
          contentType: row.image.contentType as RequestImageContentType | null,
        }
      : null,
  };
}

function responseRecord(row: HelpRequestResponseRow): HelpRequestResponseRecord {
  return row;
}

function searchFilter(q: string): Prisma.HelpRequestWhereInput {
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { customNeed: { contains: q, mode: "insensitive" } },
    ],
  };
}

function filters(input: HelpRequestListQuery): Prisma.HelpRequestWhereInput {
  return {
    ...(input.category ? { category: input.category } : {}),
    ...(input.requestType ? { requestType: input.requestType } : {}),
    ...(input.sport ? { sport: input.sport } : {}),
    ...(input.subcategoryId ? { subcategoryId: input.subcategoryId } : {}),
    ...(input.needId ? { needId: input.needId } : {}),
    ...(input.surface ? { taxonomyNeed: { surfaces: { some: { surface: input.surface } } } } : {}),
    ...(input.surface === "PLAY" ? { requestType: "SPORT", sport: "FOOTBALL" } : {}),
    ...(input.surface === "ATHLETES" ? { requestType: "SPORT", NOT: { sport: "FOOTBALL" } } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.houma ? { houma: input.houma } : {}),
    ...(input.q ? { AND: [searchFilter(input.q)] } : {}),
  };
}

function page(rows: readonly HelpRequestRow[], limit: number): HelpRequestPage {
  const items = rows.slice(0, limit);
  return {
    items: items.map(record),
    nextCursor: rows.length > limit ? (items[items.length - 1]?.id ?? null) : null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "P2002",
  );
}

export class PrismaRequestRepository implements RequestRepository, RequestVisibilityReader {
  constructor(private readonly db: PrismaClient) {}

  async create(
    createdByUserId: string,
    input: HelpRequestCreatePersistenceInput,
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
          requestType: input.requestType ?? null,
          sport: input.sport ?? null,
          subcategoryId: input.subcategoryId ?? null,
          needId: input.needId ?? null,
          customNeed: input.customNeed ?? null,
          title: input.title,
          description: input.description,
          quantityNeeded: input.quantityNeeded ?? null,
          sizeLabel: input.sizeLabel ?? null,
          conditionPreference: input.conditionPreference ?? null,
          placeId: input.placeId ?? null,
          city: input.city ?? null,
          houma: input.houma ?? null,
          fullAddress: input.fullAddress ?? null,
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

  async getById(id: string): Promise<HelpRequestRecord | null> {
    const row = await this.db.helpRequest.findUnique({
      where: { id },
      select: helpRequestSelect,
    });
    return row ? record(row) : null;
  }

  async createResponse(
    requestId: string,
    responderUserId: string,
    message: string,
  ): Promise<HelpRequestResponseRecord | null> {
    try {
      return responseRecord(
        await this.db.helpRequestResponse.create({
          data: { requestId, responderUserId, message },
          select: helpRequestResponseSelect,
        }),
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  async listResponses(requestId: string): Promise<readonly HelpRequestResponseRecord[]> {
    const rows = await this.db.helpRequestResponse.findMany({
      where: { requestId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: helpRequestResponseSelect,
    });
    return rows.map(responseRecord);
  }

  async getResponseById(
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponseRecord | null> {
    const row = await this.db.helpRequestResponse.findFirst({
      where: { id: responseId, requestId },
      select: helpRequestResponseSelect,
    });
    return row ? responseRecord(row) : null;
  }

  async getResponseByResponder(
    requestId: string,
    responderUserId: string,
  ): Promise<HelpRequestResponseRecord | null> {
    const row = await this.db.helpRequestResponse.findUnique({
      where: { requestId_responderUserId: { requestId, responderUserId } },
      select: helpRequestResponseSelect,
    });
    return row ? responseRecord(row) : null;
  }

  async acceptResponse(
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponseRecord | null> {
    const now = new Date();
    try {
      return await this.db.$transaction(async (tx) => {
        const responseUpdate = await tx.helpRequestResponse.updateMany({
          where: { id: responseId, requestId, status: "PENDING" },
          data: { status: "ACCEPTED", acceptedAt: now },
        });
        if (responseUpdate.count !== 1) return null;

        const requestUpdate = await tx.helpRequest.updateMany({
          where: { id: requestId, status: { in: ["OPEN", "IN_PROGRESS"] } },
          data: { status: "IN_PROGRESS" },
        });
        if (requestUpdate.count !== 1) throw new RequestMutationConflict();

        const row = await tx.helpRequestResponse.findUnique({
          where: { id: responseId },
          select: helpRequestResponseSelect,
        });
        if (!row) throw new RequestMutationConflict();
        return responseRecord(row);
      });
    } catch (error) {
      if (error instanceof RequestMutationConflict) return null;
      throw error;
    }
  }

  async declineResponse(
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponseRecord | null> {
    const result = await this.db.helpRequestResponse.updateMany({
      where: { id: responseId, requestId, status: "PENDING" },
      data: { status: "DECLINED", declinedAt: new Date() },
    });
    if (result.count !== 1) return null;
    return this.getResponseById(requestId, responseId);
  }

  async withdrawResponse(
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponseRecord | null> {
    const result = await this.db.helpRequestResponse.updateMany({
      where: {
        id: responseId,
        requestId,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    if (result.count !== 1) return null;
    return this.getResponseById(requestId, responseId);
  }

  async transitionRequestStatus(
    id: string,
    from: readonly HelpRequestStatus[],
    to: HelpRequestStatus,
  ): Promise<HelpRequestRecord | null> {
    const now = new Date();
    const result = await this.db.helpRequest.updateMany({
      where: { id, status: { in: [...from] } },
      data: {
        status: to,
        ...(to === "FULFILLED" ? { fulfilledAt: now } : {}),
        ...(to === "CANCELLED" ? { cancelledAt: now } : {}),
      },
    });
    if (result.count !== 1) return null;
    return this.getById(id);
  }

  async expireDue(now: Date): Promise<number> {
    return expireDueHelpRequests(this.db, now);
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
    if (assignments.some((assignment) => assignment.role === "ASSISTANT"))
      return "ASSISTANT" as const;
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
