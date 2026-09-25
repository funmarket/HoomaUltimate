import type {
  HelpRequest,
  HelpRequestCreateInput,
  HelpRequestList,
  HelpRequestListQuery,
  HelpRequestRespondInput,
  HelpRequestResponse,
  HelpRequestResponseList,
} from "@hooma/contracts/requests";
import type { AthletesSport } from "@hooma/contracts/athletes";
import type { HelpCategory } from "@hooma/contracts/help";
import type { HelpTaxonomySelectionReader } from "../../help-taxonomy/application/help-taxonomy.repository.js";
import type {
  UserPresentationReader,
  UserPresentationSummary,
} from "../../identity/application/user-presentation.reader.js";
import { RequestError } from "../domain/request-error.js";
import { canManageRequest, requireManageRequest } from "./request-authorization.js";
import type {
  HelpRequestRecord,
  HelpRequestResponseRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "./request.repository.js";

const sportLabels: Record<AthletesSport, string> = {
  CYCLING: "Cycling",
  RUNNING: "Running",
  SWIMMING: "Swimming",
  FOOTBALL: "Football",
  BASKETBALL: "Basketball",
  TENNIS: "Tennis",
  PADEL: "Padel",
  GYM_FITNESS: "Gym & Fitness",
  OTHER: "Other",
};

function serializePresentation(presentation: UserPresentationSummary | null) {
  return presentation
    ? {
        displayName: presentation.displayName,
        username: presentation.username,
        photoUrl: presentation.photoUrl,
      }
    : null;
}

function serialize(
  record: HelpRequestRecord,
  requester: UserPresentationSummary | null = null,
): HelpRequest {
  const { taxonomySubcategory, taxonomyNeed, fullAddress, image, ...rest } = record;
  void fullAddress;
  return {
    ...rest,
    requester: serializePresentation(requester),
    image: image
      ? {
          ...image,
          updatedAt: image.updatedAt.toISOString(),
        }
      : null,
    taxonomy:
      record.requestType && taxonomySubcategory && taxonomyNeed
        ? {
            requestType: record.requestType,
            sport: record.sport,
            sportLabel: record.sport ? sportLabels[record.sport] : null,
            subcategory: taxonomySubcategory,
            need: taxonomyNeed,
          }
        : null,
    neededByAt: record.neededByAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    fulfilledAt: record.fulfilledAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeResponse(
  record: HelpRequestResponseRecord,
  responder: UserPresentationSummary | null = null,
): HelpRequestResponse {
  return {
    ...record,
    responder: serializePresentation(responder),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    declinedAt: record.declinedAt?.toISOString() ?? null,
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
  };
}

export class RequestService {
  constructor(
    private readonly repository: RequestRepository,
    private readonly visibility: RequestVisibilityReader,
    private readonly taxonomy?: HelpTaxonomySelectionReader,
    private readonly userPresentations?: UserPresentationReader,
  ) {}

  private async presentationMap(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserPresentationSummary>> {
    if (!this.userPresentations || !userIds.length) return new Map();

    const uniqueUserIds = [...new Set(userIds)];
    const summaries = await this.userPresentations.findByUserIds(uniqueUserIds);
    return new Map(summaries.map((summary) => [summary.userId, summary]));
  }

  private async serializePage(page: {
    readonly items: readonly HelpRequestRecord[];
    readonly nextCursor: string | null;
  }): Promise<HelpRequestList> {
    const requesters = await this.presentationMap(
      page.items.map((record) => record.createdByUserId),
    );
    return {
      items: page.items.map((record) =>
        serialize(record, requesters.get(record.createdByUserId) ?? null),
      ),
      nextCursor: page.nextCursor,
    };
  }

  private async serializeOne(record: HelpRequestRecord): Promise<HelpRequest> {
    const requesters = await this.presentationMap([record.createdByUserId]);
    return serialize(record, requesters.get(record.createdByUserId) ?? null);
  }

  private async serializeResponses(
    records: readonly HelpRequestResponseRecord[],
  ): Promise<HelpRequestResponse[]> {
    const responders = await this.presentationMap(records.map((record) => record.responderUserId));
    return records.map((record) =>
      serializeResponse(record, responders.get(record.responderUserId) ?? null),
    );
  }

  private async serializeResponseOne(
    record: HelpRequestResponseRecord,
  ): Promise<HelpRequestResponse> {
    const responders = await this.presentationMap([record.responderUserId]);
    return serializeResponse(record, responders.get(record.responderUserId) ?? null);
  }

  async create(userId: string, input: HelpRequestCreateInput): Promise<HelpRequest> {
    await this.requirePublisherAuthority(userId, input);
    await this.requireAudienceMembership(userId, input);

    const requestType =
      input.requestType ?? (input.sport && input.subcategoryId && input.needId ? "SPORT" : null);

    if (requestType && input.subcategoryId && input.needId) {
      const selection = await this.taxonomy?.findActiveSelection({
        requestType,
        sport: input.sport ?? null,
        subcategoryId: input.subcategoryId,
        needId: input.needId,
      });
      if (!selection) {
        throw new RequestError("REQUEST_TAXONOMY_INVALID", "Request taxonomy selection is invalid");
      }

      const hasProductMetadata = Boolean(
        input.quantityNeeded || input.sizeLabel || input.conditionPreference,
      );
      if (selection.need.kind !== "PRODUCT" && hasProductMetadata) {
        throw new RequestError(
          "REQUEST_PRODUCT_METADATA_FORBIDDEN",
          "Product metadata is only allowed for product needs",
        );
      }
      if (input.customNeed && !selection.need.allowsCustomText) {
        throw new RequestError(
          "REQUEST_CUSTOM_NEED_FORBIDDEN",
          "Custom need text is not allowed for this need",
        );
      }
      if (selection.need.allowsCustomText && !input.customNeed) {
        throw new RequestError(
          "REQUEST_CUSTOM_NEED_REQUIRED",
          "Custom need text is required for this need",
        );
      }

      const categoryByKind: Record<typeof selection.need.kind, HelpCategory> = {
        PRODUCT: "ITEM",
        COMMUNITY_ROLE: "PEOPLE",
        COMMUNITY_SUPPORT: "COMMUNITY",
      };
      return serialize(
        await this.repository.create(userId, {
          ...input,
          requestType,
          sport: requestType === "SPORT" ? input.sport : null,
          category: categoryByKind[selection.need.kind],
          itemKind: null,
        }),
      );
    }

    if (!input.category) {
      throw new RequestError("REQUEST_TAXONOMY_INVALID", "Request taxonomy selection is required");
    }
    return serialize(
      await this.repository.create(userId, {
        ...input,
        category: input.category,
        itemKind: input.itemKind ?? null,
      }),
    );
  }

  async listPublic(input: HelpRequestListQuery): Promise<HelpRequestList> {
    return this.serializePage(await this.repository.listPublic(input));
  }

  async getPublic(id: string): Promise<HelpRequest> {
    const request = await this.repository.getPublic(id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.serializeOne(request);
  }

  async listForMember(userId: string, input: HelpRequestListQuery): Promise<HelpRequestList> {
    return this.serializePage(await this.repository.listVisibleToMember(userId, input));
  }

  async getForMember(userId: string, id: string): Promise<HelpRequest> {
    const request = await this.repository.getVisibleToMember(userId, id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.serializeOne(request);
  }

  async respond(
    userId: string,
    requestId: string,
    input: HelpRequestRespondInput,
  ): Promise<HelpRequestResponse> {
    const request = await this.repository.getVisibleToMember(userId, requestId);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    if (request.status !== "OPEN" && request.status !== "IN_PROGRESS") {
      throw new RequestError("REQUEST_NOT_RESPONDABLE", "Request is not accepting responses");
    }
    if (
      request.createdByUserId === userId ||
      (await canManageRequest(this.visibility, userId, request))
    ) {
      throw new RequestError("REQUEST_SELF_RESPONSE_FORBIDDEN", "Request managers cannot respond");
    }
    const created = await this.repository.createResponse(requestId, userId, input.message);
    if (!created) {
      throw new RequestError("REQUEST_RESPONSE_ALREADY_EXISTS", "Response already exists");
    }
    return this.serializeResponseOne(created);
  }

  async listResponses(userId: string, requestId: string): Promise<HelpRequestResponseList> {
    const request = await this.repository.getById(requestId);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    if (await canManageRequest(this.visibility, userId, request)) {
      return {
        items: await this.serializeResponses(await this.repository.listResponses(requestId)),
      };
    }
    const own = await this.repository.getResponseByResponder(requestId, userId);
    if (!own) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return { items: [await this.serializeResponseOne(own)] };
  }

  async acceptResponse(
    userId: string,
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponse> {
    const request = await requireManageRequest(this.repository, this.visibility, userId, requestId);
    this.requireMutable(request);
    const response = await this.repository.acceptResponse(requestId, responseId);
    if (!response) {
      throw new RequestError("REQUEST_RESPONSE_NOT_PENDING", "Response is not pending");
    }
    return this.serializeResponseOne(response);
  }

  async declineResponse(
    userId: string,
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponse> {
    const request = await requireManageRequest(this.repository, this.visibility, userId, requestId);
    this.requireMutable(request);
    const response = await this.repository.declineResponse(requestId, responseId);
    if (!response) {
      throw new RequestError("REQUEST_RESPONSE_NOT_PENDING", "Response is not pending");
    }
    return this.serializeResponseOne(response);
  }

  async withdrawResponse(
    userId: string,
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponse> {
    const response = await this.repository.getResponseById(requestId, responseId);
    if (!response || response.responderUserId !== userId) {
      throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    }
    const withdrawn = await this.repository.withdrawResponse(requestId, responseId);
    if (!withdrawn) {
      throw new RequestError("REQUEST_RESPONSE_NOT_WITHDRAWABLE", "Response cannot be withdrawn");
    }
    return this.serializeResponseOne(withdrawn);
  }

  async fulfill(userId: string, requestId: string): Promise<HelpRequest> {
    const request = await requireManageRequest(this.repository, this.visibility, userId, requestId);
    this.requireMutable(request);
    const updated = await this.repository.transitionRequestStatus(
      requestId,
      ["OPEN", "IN_PROGRESS"],
      "FULFILLED",
    );
    if (!updated) throw new RequestError("REQUEST_STATUS_CONFLICT", "Request status changed");
    return serialize(updated);
  }

  async cancel(userId: string, requestId: string): Promise<HelpRequest> {
    const request = await requireManageRequest(this.repository, this.visibility, userId, requestId);
    this.requireMutable(request);
    const updated = await this.repository.transitionRequestStatus(
      requestId,
      ["OPEN", "IN_PROGRESS"],
      "CANCELLED",
    );
    if (!updated) throw new RequestError("REQUEST_STATUS_CONFLICT", "Request status changed");
    return serialize(updated);
  }

  async expireDue(now: Date): Promise<number> {
    return this.repository.expireDue(now);
  }

  private requireMutable(request: HelpRequestRecord): void {
    if (request.status !== "OPEN" && request.status !== "IN_PROGRESS") {
      throw new RequestError("REQUEST_NOT_MUTABLE", "Request is not mutable");
    }
  }

  private async requirePublisherAuthority(userId: string, input: HelpRequestCreateInput) {
    const publisher = input.publisher;
    if (publisher.publisherCommunityId) {
      const role = await this.visibility.communityRole(publisher.publisherCommunityId, userId);
      if (role !== "FOUNDER" && role !== "COACH") {
        throw new RequestError(
          "REQUEST_COMMUNITY_PUBLISHER_FORBIDDEN",
          "Founder or Coach access required",
        );
      }
      return;
    }

    if (publisher.publisherTeamId) {
      const responsibility = await this.visibility.teamResponsibility(
        publisher.publisherTeamId,
        userId,
      );
      if (responsibility !== "COACH") {
        throw new RequestError("REQUEST_TEAM_PUBLISHER_FORBIDDEN", "Team Coach access required");
      }
      return;
    }

    if (publisher.publisherAthletesCommunityId) {
      const role = await this.visibility.athletesRole(
        publisher.publisherAthletesCommunityId,
        userId,
      );
      if (role !== "FOUNDER" && role !== "MODERATOR") {
        throw new RequestError(
          "REQUEST_ATHLETES_PUBLISHER_FORBIDDEN",
          "Athletes Founder or Moderator access required",
        );
      }
    }
  }

  private async requireAudienceMembership(userId: string, input: HelpRequestCreateInput) {
    if (input.audience.scope === "HOOMA_COMMUNITY") {
      if (!(await this.visibility.isCommunityMember(input.audience.communityId, userId))) {
        throw new RequestError("REQUEST_AUDIENCE_MEMBERSHIP_REQUIRED", "HOOMA membership required");
      }
      return;
    }

    if (
      input.audience.scope === "ATHLETES_COMMUNITY" &&
      !(await this.visibility.isAthletesMember(input.audience.athletesCommunityId, userId))
    ) {
      throw new RequestError(
        "REQUEST_AUDIENCE_MEMBERSHIP_REQUIRED",
        "Athletes membership required",
      );
    }
  }
}
