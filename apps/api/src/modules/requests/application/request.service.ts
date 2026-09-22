import type {
  HelpRequest,
  HelpRequestCreateInput,
  HelpRequestList,
  HelpRequestListQuery,
  HelpRequestRespondInput,
  HelpRequestResponse,
  HelpRequestResponseList,
  RequestImageUploadInput,
  RequestRequesterPresentation,
} from "@hooma/contracts/requests";
import type { AthletesSport } from "@hooma/contracts/athletes";
import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { randomUUID } from "node:crypto";
import type { HelpRequestType } from "@hooma/contracts/help-taxonomy";
import type { HelpCategory } from "@hooma/contracts/help";
import type { HelpTaxonomySelectionReader } from "../../help-taxonomy/application/help-taxonomy.repository.js";
import { RequestError } from "../domain/request-error.js";
import type { RequestImageValidator } from "./request-image-validator.js";
import type {
  HelpRequestRecord,
  HelpRequestResponseRecord,
  RequestRepository,
  RequestRequesterReader,
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

/**
 * MIME allowlist and size cap for an uploaded Request photo. Mirrors the
 * existing uploaded-image rules used by Ride offers and Gamer match proofs.
 */
const REQUEST_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function normalizeImageContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function requestImageObjectKey(requestId: string): string {
  return `requests/${requestId}/${randomUUID()}`;
}

/**
 * A precisely addressed Request is privacy-sensitive: `fullAddress` is only
 * projected back to the person who wrote the Request. Every other reader
 * (public, community member, publisher, responder) gets the coarse
 * city/houma/locationNote projection until a product owner decides otherwise.
 *
 * The private object-storage key and its stored content metadata are never
 * serialized: clients receive the single normalized image representation as
 * `imageUrl` plus `hasUploadedImage`.
 */
function serialize(
  record: HelpRequestRecord,
  includePreciseLocation: boolean,
  requester: RequestRequesterPresentation | null,
): HelpRequest {
  const {
    taxonomySubcategory,
    taxonomyNeed,
    imageObjectKey,
    imageContentType,
    imageSizeBytes,
    ...rest
  } = record;
  const requestType: HelpRequestType | null = record.requestType;
  return {
    ...rest,
    requester,
    // An uploaded photo exists only when the object key, its stored content
    // type and a positive byte size were all recorded together. The three
    // fields are stripped from `rest` and never reach a client.
    hasUploadedImage: Boolean(imageObjectKey && imageContentType && imageSizeBytes),
    fullAddress: includePreciseLocation ? record.fullAddress : null,
    taxonomy:
      requestType && record.subcategoryId && taxonomySubcategory && taxonomyNeed
        ? {
            requestType,
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

function serializeResponse(record: HelpRequestResponseRecord): HelpRequestResponse {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    declinedAt: record.declinedAt?.toISOString() ?? null,
    withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
  };
}

function serializePage(
  page: {
    readonly items: readonly HelpRequestRecord[];
    readonly nextCursor: string | null;
  },
  isPreciseLocationReader: (record: HelpRequestRecord) => boolean,
  requesters: ReadonlyMap<string, RequestRequesterPresentation>,
): HelpRequestList {
  return {
    items: page.items.map((item) =>
      serialize(item, isPreciseLocationReader(item), requesters.get(item.createdByUserId) ?? null),
    ),
    nextCursor: page.nextCursor,
  };
}

export class RequestService {
  constructor(
    private readonly repository: RequestRepository,
    private readonly visibility: RequestVisibilityReader,
    private readonly taxonomy?: HelpTaxonomySelectionReader,
    private readonly storage: ObjectStorage | null = null,
    private readonly requesters: RequestRequesterReader | null = null,
    private readonly imageValidator: RequestImageValidator | null = null,
  ) {}

  async create(userId: string, input: HelpRequestCreateInput): Promise<HelpRequest> {
    await this.requirePublisherAuthority(userId, input);
    await this.requireAudienceMembership(userId, input);

    const requestType: HelpRequestType | null = input.requestType ?? null;
    if (requestType && input.subcategoryId && input.needId) {
      const sport = requestType === "SPORT" ? (input.sport ?? null) : null;
      if (requestType === "SPORT" && !sport) {
        throw new RequestError("REQUEST_TAXONOMY_INVALID", "Sport is required for sport requests");
      }
      const selection = await this.taxonomy?.findActiveSelection({
        requestType,
        sport,
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
      if (!input.customNeed && selection.need.allowsCustomText) {
        throw new RequestError(
          "REQUEST_CUSTOM_NEED_REQUIRED",
          "This need requires the requester's own text",
        );
      }

      const categoryByKind: Record<typeof selection.need.kind, HelpCategory> = {
        PRODUCT: "ITEM",
        COMMUNITY_ROLE: "PEOPLE",
        COMMUNITY_SUPPORT: "COMMUNITY",
      };
      return this.present(
        await this.repository.create(userId, {
          ...input,
          requestType,
          sport,
          category: categoryByKind[selection.need.kind],
          itemKind: null,
        }),
        true,
      );
    }

    if (!input.category) {
      throw new RequestError("REQUEST_TAXONOMY_INVALID", "Request taxonomy selection is required");
    }
    return this.present(
      await this.repository.create(userId, {
        ...input,
        requestType: null,
        category: input.category,
        itemKind: input.itemKind ?? null,
      }),
      true,
    );
  }

  async listPublic(input: HelpRequestListQuery): Promise<HelpRequestList> {
    return this.presentPage(await this.repository.listPublic(input), () => false);
  }

  async getPublic(id: string): Promise<HelpRequest> {
    const request = await this.repository.getPublic(id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.present(request, false);
  }

  async listForMember(userId: string, input: HelpRequestListQuery): Promise<HelpRequestList> {
    return this.presentPage(
      await this.repository.listVisibleToMember(userId, input),
      (record) => record.createdByUserId === userId,
    );
  }

  async getForMember(userId: string, id: string): Promise<HelpRequest> {
    const request = await this.repository.getVisibleToMember(userId, id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.present(request, request.createdByUserId === userId);
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
    if (request.createdByUserId === userId || (await this.canManage(userId, request))) {
      throw new RequestError("REQUEST_SELF_RESPONSE_FORBIDDEN", "Request managers cannot respond");
    }
    const created = await this.repository.createResponse(requestId, userId, input.message);
    if (!created) {
      throw new RequestError("REQUEST_RESPONSE_ALREADY_EXISTS", "Response already exists");
    }
    return serializeResponse(created);
  }

  async listResponses(userId: string, requestId: string): Promise<HelpRequestResponseList> {
    const request = await this.repository.getById(requestId);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    if (await this.canManage(userId, request)) {
      return { items: (await this.repository.listResponses(requestId)).map(serializeResponse) };
    }
    const own = await this.repository.getResponseByResponder(requestId, userId);
    if (!own) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return { items: [serializeResponse(own)] };
  }

  async acceptResponse(
    userId: string,
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponse> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);
    const response = await this.repository.acceptResponse(requestId, responseId);
    if (!response) {
      throw new RequestError("REQUEST_RESPONSE_NOT_PENDING", "Response is not pending");
    }
    return serializeResponse(response);
  }

  async declineResponse(
    userId: string,
    requestId: string,
    responseId: string,
  ): Promise<HelpRequestResponse> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);
    const response = await this.repository.declineResponse(requestId, responseId);
    if (!response) {
      throw new RequestError("REQUEST_RESPONSE_NOT_PENDING", "Response is not pending");
    }
    return serializeResponse(response);
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
    return serializeResponse(withdrawn);
  }

  async fulfill(userId: string, requestId: string): Promise<HelpRequest> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);
    const updated = await this.repository.transitionRequestStatus(
      requestId,
      ["OPEN", "IN_PROGRESS"],
      "FULFILLED",
    );
    if (!updated) throw new RequestError("REQUEST_STATUS_CONFLICT", "Request status changed");
    return this.present(updated, updated.createdByUserId === userId);
  }

  async cancel(userId: string, requestId: string): Promise<HelpRequest> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);
    const updated = await this.repository.transitionRequestStatus(
      requestId,
      ["OPEN", "IN_PROGRESS"],
      "CANCELLED",
    );
    if (!updated) throw new RequestError("REQUEST_STATUS_CONFLICT", "Request status changed");
    return this.present(updated, updated.createdByUserId === userId);
  }

  async expireDue(now: Date): Promise<number> {
    return this.repository.expireDue(now);
  }

  /**
   * Replaces the Request photo with one server-authorized uploaded image.
   * Only the Request owner or a Request manager may replace it, only JPEG/PNG/WebP
   * up to 5 MiB is accepted, and the bytes go to the canonical object storage.
   */
  async replaceImage(
    userId: string,
    requestId: string,
    input: RequestImageUploadInput,
  ): Promise<HelpRequest> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);

    const contentType = normalizeImageContentType(input.contentType);
    if (!REQUEST_IMAGE_TYPES.has(contentType)) {
      throw new RequestError(
        "REQUEST_IMAGE_TYPE_INVALID",
        "Request photo must be JPEG, PNG or WebP",
      );
    }
    if (!input.body.byteLength || input.body.byteLength > REQUEST_IMAGE_MAX_BYTES) {
      throw new RequestError(
        "REQUEST_IMAGE_TOO_LARGE",
        "Request photo must be between 1 byte and 5 MiB",
      );
    }
    if (!this.storage || !this.imageValidator) {
      throw new RequestError(
        "REQUEST_IMAGE_STORAGE_UNAVAILABLE",
        "Request photo storage is not configured",
      );
    }

    // Declared type and length are not proof: the bytes must decode as the
    // declared image type before they are stored.
    await this.imageValidator.validate(input.body, contentType);

    const objectKey = requestImageObjectKey(requestId);
    const stored = await this.storage.put(objectKey, input.body, contentType);
    const result = await this.repository.setUploadedImage(requestId, {
      objectKey: stored.key,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
    });
    if (!result) {
      await this.removeImageObject(stored.key);
      throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    }
    if (result.previousObjectKey && result.previousObjectKey !== stored.key) {
      await this.removeImageObject(result.previousObjectKey);
    }

    const updated = await this.repository.getById(requestId);
    if (!updated) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.present(updated, updated.createdByUserId === userId);
  }

  async deleteImage(userId: string, requestId: string): Promise<void> {
    const request = await this.requireManage(userId, requestId);
    this.requireMutable(request);
    const result = await this.repository.clearImage(requestId);
    if (!result) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    if (result.previousObjectKey) await this.removeImageObject(result.previousObjectKey);
  }

  /** Public photo delivery: only a publicly visible Request releases its stored bytes. */
  async getPublicImage(requestId: string): Promise<StoredObject> {
    const request = await this.repository.getPublic(requestId);
    if (!request) throw new RequestError("REQUEST_IMAGE_NOT_FOUND", "Request photo not found");
    return this.readImage(requestId);
  }

  /** Member photo delivery: the stored bytes follow the Request's own visibility rules. */
  async getMemberImage(userId: string, requestId: string): Promise<StoredObject> {
    const request = await this.repository.getVisibleToMember(userId, requestId);
    if (!request) throw new RequestError("REQUEST_IMAGE_NOT_FOUND", "Request photo not found");
    return this.readImage(requestId);
  }

  private async readImage(requestId: string): Promise<StoredObject> {
    const metadata = await this.repository.getImageMetadata(requestId);
    if (!metadata) {
      throw new RequestError("REQUEST_IMAGE_NOT_FOUND", "Request photo not found");
    }
    if (!this.storage) {
      throw new RequestError(
        "REQUEST_IMAGE_STORAGE_UNAVAILABLE",
        "Request photo storage is not configured",
      );
    }
    return this.storage.get(metadata.objectKey);
  }

  /**
   * Best-effort object cleanup after a replace/delete. A failure here leaves an
   * orphaned object but never breaks the Request itself, so it is reported
   * through the structured error entry instead of being swallowed.
   */
  private async removeImageObject(objectKey: string): Promise<void> {
    if (!this.storage) return;
    try {
      await this.storage.remove(objectKey);
    } catch (error) {
      this.onImageCleanupFailure(objectKey, error);
    }
  }

  protected onImageCleanupFailure(objectKey: string, error: unknown): void {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "request.image.cleanup_failed",
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  /**
   * Attaches the canonical requester identity to one serialized Request. The
   * reader is optional so tests and taxonomy-only wiring keep working: without
   * it the card renders no identity block instead of a fabricated one.
   */
  private async present(
    record: HelpRequestRecord,
    includePreciseLocation: boolean,
  ): Promise<HelpRequest> {
    const requesters = await this.loadRequesters([record.createdByUserId]);
    return serialize(
      record,
      includePreciseLocation,
      requesters.get(record.createdByUserId) ?? null,
    );
  }

  private async presentPage(
    page: { readonly items: readonly HelpRequestRecord[]; readonly nextCursor: string | null },
    isPreciseLocationReader: (record: HelpRequestRecord) => boolean,
  ): Promise<HelpRequestList> {
    const requesters = await this.loadRequesters(page.items.map((item) => item.createdByUserId));
    return serializePage(page, isPreciseLocationReader, requesters);
  }

  /** One batched identity read per page: a Request feed never fans out per row. */
  private async loadRequesters(
    userIds: readonly string[],
  ): Promise<Map<string, RequestRequesterPresentation>> {
    const byUserId = new Map<string, RequestRequesterPresentation>();
    if (!this.requesters || userIds.length === 0) return byUserId;
    const presentations = await this.requesters.findPresentations(userIds);
    for (const presentation of presentations) {
      byUserId.set(presentation.userId, presentation);
    }
    return byUserId;
  }

  private async requireManage(userId: string, requestId: string): Promise<HelpRequestRecord> {
    const request = await this.repository.getById(requestId);
    if (!request || !(await this.canManage(userId, request))) {
      throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    }
    return request;
  }

  private requireMutable(request: HelpRequestRecord): void {
    if (request.status !== "OPEN" && request.status !== "IN_PROGRESS") {
      throw new RequestError("REQUEST_NOT_MUTABLE", "Request is not mutable");
    }
  }

  private async canManage(userId: string, request: HelpRequestRecord): Promise<boolean> {
    if (request.publisherCommunityId) {
      const role = await this.visibility.communityRole(request.publisherCommunityId, userId);
      return role === "FOUNDER" || role === "COACH";
    }
    if (request.publisherTeamId) {
      return (
        (await this.visibility.teamResponsibility(request.publisherTeamId, userId)) === "COACH"
      );
    }
    if (request.publisherAthletesCommunityId) {
      const role = await this.visibility.athletesRole(request.publisherAthletesCommunityId, userId);
      return role === "FOUNDER" || role === "MODERATOR";
    }
    return request.createdByUserId === userId;
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
