import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { randomUUID } from "node:crypto";
import { rideMineQuerySchema } from "@hooma/contracts/rides";
import type {
  RideMeetingPointInput,
  RideMine,
  RideMineListQuery,
  RideMineQuery,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideOfferStatus,
  RideOfferUpdateInput,
  RideParticipationRequestInput,
  RideParticipationStatus,
  RideRequestCreateInput,
  RideRequestStatus,
  RideRequestUpdateInput,
} from "@hooma/contracts/rides";
import type { UserPresentationReader } from "../../identity/application/user-presentation.reader.js";
import type { RideCommunityMembershipReader } from "./ride-community-membership.reader.js";
import { RideError } from "../domain/ride-error.js";
import { RidePolicyError } from "../domain/ride-policy.js";
import type {
  RideMeetingPointRepository,
  RideOfferListInput,
  RideOfferForOwnerRecord,
  RideOfferRepository,
  RideParticipationRepository,
} from "./ride-offer.repository.js";
import type {
  RideEventReferenceReader,
  RidePlaceReferenceReader,
} from "./ride-reference.readers.js";
import type {
  RideVehiclePhotoMetadata,
  RideVehiclePhotoRepository,
} from "./ride-vehicle-photo.repository.js";
import type { RideRequestListInput, RideRequestRepository } from "./ride-request.repository.js";

type PublicRideOfferListInput = Omit<RideOfferListInput, "limit"> & { readonly limit?: number };
type PublicRideRequestListInput = Omit<RideRequestListInput, "limit"> & { readonly limit?: number };
export interface RideVehiclePhotoUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const RIDE_VEHICLE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const RIDE_VEHICLE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class RideService {
  constructor(
    private readonly offers: RideOfferRepository,
    private readonly requests: RideRequestRepository,
    private readonly participations: RideParticipationRepository,
    private readonly meetingPoints: RideMeetingPointRepository,
    private readonly events: RideEventReferenceReader,
    private readonly places: RidePlaceReferenceReader,
    private readonly communityMemberships: RideCommunityMembershipReader,
    private readonly userPresentations: UserPresentationReader,
    private readonly vehiclePhotos: RideVehiclePhotoRepository,
    private readonly storage: ObjectStorage | null,
  ) {}

  listPublicOffers(input: PublicRideOfferListInput = {}) {
    return this.offers.listPublic(normalizeOfferListInput(input));
  }

  async getPublicOffer(rideOfferId: string) {
    const offer = await this.offers.getPublic(rideOfferId);
    if (!offer) throw new RideError("RIDE_OFFER_NOT_FOUND", "Ride offer not found");
    return offer;
  }

  async getMyOffer(driverUserId: string, rideOfferId: string) {
    return this.withRideOfferPresentations(await this.requireOfferOwner(driverUserId, rideOfferId));
  }

  async createOffer(driverUserId: string, input: RideOfferCreateInput) {
    await this.validateDestination(input.destination);
    const offer = await this.withRidePolicy(() => this.offers.create(driverUserId, input));
    return this.withRideOfferPresentations(offer);
  }

  async updateOffer(driverUserId: string, rideOfferId: string, input: RideOfferUpdateInput) {
    await this.requireOfferOwner(driverUserId, rideOfferId);
    if (input.destination) await this.validateDestination(input.destination);

    return this.withRidePolicy(async () => {
      const updated = await this.offers.update(rideOfferId, driverUserId, input);
      if (!updated) {
        throw new RideError(
          "RIDE_OFFER_NOT_MUTABLE",
          "Ride offer cannot be changed in its current state",
        );
      }
      return this.withRideOfferPresentations(updated);
    });
  }

  cancelOffer(driverUserId: string, rideOfferId: string) {
    return this.setOfferStatus(driverUserId, rideOfferId, "CANCELLED");
  }

  departOffer(driverUserId: string, rideOfferId: string) {
    return this.setOfferStatus(driverUserId, rideOfferId, "DEPARTED");
  }

  completeOffer(driverUserId: string, rideOfferId: string) {
    return this.setOfferStatus(driverUserId, rideOfferId, "COMPLETED");
  }

  listPublicRequests(input: PublicRideRequestListInput = {}) {
    return this.requests.listPublic(normalizeRequestListInput(input));
  }

  async getPublicRequest(rideRequestId: string) {
    const request = await this.requests.getPublic(rideRequestId);
    if (!request) throw new RideError("RIDE_REQUEST_NOT_FOUND", "Ride request not found");
    return request;
  }

  async getMyRequest(requesterUserId: string, rideRequestId: string) {
    return this.requireRequestOwner(requesterUserId, rideRequestId);
  }

  async createRequest(requesterUserId: string, input: RideRequestCreateInput) {
    await this.validateDestination(input.destination);
    await this.validateAudienceCommand(requesterUserId, input.audience);
    return this.withRidePolicy(() => this.requests.create(requesterUserId, input));
  }

  async updateRequest(
    requesterUserId: string,
    rideRequestId: string,
    input: RideRequestUpdateInput,
  ) {
    await this.requireRequestOwner(requesterUserId, rideRequestId);
    if (input.destination) await this.validateDestination(input.destination);
    if (input.audience) await this.validateAudienceCommand(requesterUserId, input.audience);

    return this.withRidePolicy(async () => {
      const updated = await this.requests.update(rideRequestId, requesterUserId, input);
      if (!updated) {
        throw new RideError(
          "RIDE_REQUEST_NOT_MUTABLE",
          "Ride request cannot be changed in its current state",
        );
      }
      return updated;
    });
  }

  cancelRequest(requesterUserId: string, rideRequestId: string) {
    return this.setRequestStatus(requesterUserId, rideRequestId, "CANCELLED");
  }

  expireRequest(requesterUserId: string, rideRequestId: string) {
    return this.setRequestStatus(requesterUserId, rideRequestId, "EXPIRED");
  }

  completeRequest(requesterUserId: string, rideRequestId: string) {
    return this.setRequestStatus(requesterUserId, rideRequestId, "COMPLETED");
  }

  async requestParticipation(
    passengerUserId: string,
    rideOfferId: string,
    input: RideParticipationRequestInput,
  ) {
    return this.withRidePolicy(async () => {
      const participation = await this.participations.requestParticipation(
        rideOfferId,
        passengerUserId,
        input,
      );
      if (!participation) {
        throw new RideError(
          "RIDE_PARTICIPATION_NOT_AVAILABLE",
          "Ride offer is not open for participation",
        );
      }
      return participation;
    });
  }

  async getMyParticipation(passengerUserId: string, rideOfferId: string) {
    const participation = await this.participations.getForPassenger(rideOfferId, passengerUserId);
    if (!participation) {
      throw new RideError("RIDE_PARTICIPATION_NOT_FOUND", "Ride participation not found");
    }
    return participation;
  }

  acceptParticipation(driverUserId: string, rideOfferId: string, participationId: string) {
    return this.driverSetParticipationStatus(
      driverUserId,
      rideOfferId,
      participationId,
      "ACCEPTED",
    );
  }

  rejectParticipation(driverUserId: string, rideOfferId: string, participationId: string) {
    return this.driverSetParticipationStatus(
      driverUserId,
      rideOfferId,
      participationId,
      "REJECTED",
    );
  }

  completeParticipation(driverUserId: string, rideOfferId: string, participationId: string) {
    return this.driverSetParticipationStatus(
      driverUserId,
      rideOfferId,
      participationId,
      "COMPLETED",
    );
  }

  async cancelParticipation(actorUserId: string, rideOfferId: string, participationId: string) {
    return this.withRidePolicy(async () => {
      const participation = await this.participations.updateParticipationStatus({
        rideOfferId,
        participationId,
        actorUserId,
        status: "CANCELLED",
      });
      if (!participation) {
        throw new RideError(
          "RIDE_PARTICIPATION_CANCEL_FORBIDDEN",
          "Only the driver or passenger can cancel this participation",
        );
      }
      return participation;
    });
  }

  async upsertMeetingPoint(
    driverUserId: string,
    rideOfferId: string,
    participationId: string,
    meetingPoint: RideMeetingPointInput,
  ) {
    await this.requireOfferOwner(driverUserId, rideOfferId);

    const saved = await this.meetingPoints.upsertForParticipation({
      rideOfferId,
      participationId,
      driverUserId,
      meetingPoint,
    });
    if (!saved) {
      throw new RideError(
        "RIDE_MEETING_POINT_NOT_AVAILABLE",
        "Meeting point requires an accepted participation",
      );
    }
    return saved;
  }

  async getMeetingPoint(viewerUserId: string, participationId: string) {
    const meetingPoint = await this.meetingPoints.getForAuthorizedViewer({
      participationId,
      viewerUserId,
    });
    if (!meetingPoint) {
      throw new RideError(
        "RIDE_MEETING_POINT_FORBIDDEN",
        "Ride meeting point is visible only to the driver and accepted passenger",
      );
    }
    return meetingPoint;
  }

  async getMyRides(actorUserId: string, input: RideMineQuery = {}): Promise<RideMine> {
    const query = normalizeMineQuery(input);
    const [offers, requests, participations] = await Promise.all([
      this.offers.listForDriver(actorUserId, query),
      this.requests.listForRequester(actorUserId, query),
      this.participations.listForPassenger(actorUserId, query),
    ]);

    return {
      offers,
      requests,
      participations,
    };
  }

  async listCommunityRequests(
    viewerUserId: string,
    communityId: string,
    input: PublicRideRequestListInput = {},
  ) {
    const canView = await this.communityMemberships.isActiveMemberOfCommunity(
      viewerUserId,
      communityId,
    );
    if (!canView) {
      throw new RideError(
        "RIDE_REQUEST_COMMUNITY_FEED_FORBIDDEN",
        "Community Ride requests are visible only to active HOOMA members",
      );
    }
    return this.requests.listForCommunity({
      communityId,
      viewerUserId,
      limit: normalizeLimit(input.limit),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    });
  }

  async listMyRideRequestAudienceCommunities(actorUserId: string) {
    return this.communityMemberships.listActiveMembershipCommunities(actorUserId);
  }

  async requireWhistleRead(viewerUserId: string, rideRequestId: string) {
    const context = await this.requests.getCommunityWhistleContext({ viewerUserId, rideRequestId });
    if (!context) {
      throw new RideError(
        "RIDE_WHISTLE_FORBIDDEN",
        "Ride Whistle access requires an active Ride request audience",
      );
    }
    return { ownerUserId: context.requesterUserId };
  }

  async requireWhistlePost(actorUserId: string, rideRequestId: string) {
    const context = await this.requireWhistleRead(actorUserId, rideRequestId);
    if (context.ownerUserId === actorUserId) {
      throw new RideError(
        "RIDE_WHISTLE_SELF_FORBIDDEN",
        "You cannot Whistle your own Ride request",
      );
    }
    return context;
  }

  async replaceOfferVehiclePhoto(
    driverUserId: string,
    rideOfferId: string,
    input: RideVehiclePhotoUploadInput,
  ): Promise<RideVehiclePhotoMetadata> {
    await this.requireOfferOwner(driverUserId, rideOfferId);
    const contentType = normalizeVehiclePhotoContentType(input.contentType);
    if (!RIDE_VEHICLE_PHOTO_TYPES.has(contentType)) {
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_TYPE_INVALID",
        "Ride vehicle photo must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new RideError("RIDE_VEHICLE_PHOTO_REQUIRED", "Ride vehicle photo bytes are required");
    }
    if (input.body.byteLength > RIDE_VEHICLE_PHOTO_MAX_BYTES) {
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_TOO_LARGE",
        "Ride vehicle photo must be 5 MB or smaller",
      );
    }
    if (!this.storage) {
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_STORAGE_NOT_CONFIGURED",
        "Ride vehicle photo storage is not configured",
      );
    }

    const photoId = randomUUID();
    const objectKey = rideVehiclePhotoObjectKey(rideOfferId, photoId);
    let uploadedKey: string | null = null;

    try {
      const stored = await this.storage.put(objectKey, input.body, contentType);
      uploadedKey = stored.key;
      const result = await this.vehiclePhotos.replaceForOwner({
        rideOfferId,
        driverUserId,
        photo: {
          id: photoId,
          objectKey: stored.key,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
        },
      });
      if (!result) {
        throw new RideError("RIDE_OFFER_MANAGE_FORBIDDEN", "Ride offer owner access required");
      }
      uploadedKey = null;
      if (result.previousObjectKey && result.previousObjectKey !== result.current.objectKey) {
        await this.removeOrScheduleVehiclePhotoObject(result.previousObjectKey, "REPLACED");
      }
      return publicVehiclePhotoMetadata(result.current);
    } catch (error) {
      if (uploadedKey) {
        await this.removeOrScheduleVehiclePhotoObject(
          uploadedKey,
          "ORPHANED_AFTER_METADATA_FAILURE",
        );
      }
      if (error instanceof RideError) throw error;
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_UPLOAD_FAILED",
        "Ride vehicle photo could not be saved",
      );
    }
  }

  async deleteOfferVehiclePhoto(driverUserId: string, rideOfferId: string): Promise<void> {
    await this.requireOfferOwner(driverUserId, rideOfferId);
    const deleted = await this.vehiclePhotos.deleteForOwner(rideOfferId, driverUserId);
    if (!deleted) {
      throw new RideError("RIDE_VEHICLE_PHOTO_NOT_FOUND", "Ride vehicle photo not found");
    }
    await this.removeOrScheduleVehiclePhotoObject(deleted.objectKey, "DELETED");
  }

  async getPublicOfferVehiclePhoto(rideOfferId: string): Promise<StoredObject> {
    await this.getPublicOffer(rideOfferId);
    const metadata = await this.vehiclePhotos.getForOffer(rideOfferId);
    if (!metadata) {
      throw new RideError("RIDE_VEHICLE_PHOTO_NOT_FOUND", "Ride vehicle photo not found");
    }
    if (!this.storage) {
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_STORAGE_NOT_CONFIGURED",
        "Ride vehicle photo storage is not configured",
      );
    }
    try {
      return await this.storage.get(metadata.objectKey);
    } catch {
      throw new RideError(
        "RIDE_VEHICLE_PHOTO_UNAVAILABLE",
        "Ride vehicle photo is temporarily unavailable",
      );
    }
  }

  private async setOfferStatus(driverUserId: string, rideOfferId: string, status: RideOfferStatus) {
    await this.requireOfferOwner(driverUserId, rideOfferId);

    return this.withRidePolicy(async () => {
      const updated = await this.offers.updateStatus(rideOfferId, driverUserId, status);
      if (!updated) {
        throw new RideError(
          "RIDE_OFFER_STATUS_NOT_CHANGED",
          "Ride offer status could not be changed",
        );
      }
      return this.withRideOfferPresentations(updated);
    });
  }

  private async setRequestStatus(
    requesterUserId: string,
    rideRequestId: string,
    status: RideRequestStatus,
  ) {
    await this.requireRequestOwner(requesterUserId, rideRequestId);

    return this.withRidePolicy(async () => {
      const updated = await this.requests.updateStatus(rideRequestId, requesterUserId, status);
      if (!updated) {
        throw new RideError(
          "RIDE_REQUEST_STATUS_NOT_CHANGED",
          "Ride request status could not be changed",
        );
      }
      return updated;
    });
  }

  private async driverSetParticipationStatus(
    driverUserId: string,
    rideOfferId: string,
    participationId: string,
    status: Extract<RideParticipationStatus, "ACCEPTED" | "REJECTED" | "COMPLETED">,
  ) {
    await this.requireOfferOwner(driverUserId, rideOfferId);

    return this.withRidePolicy(async () => {
      const participation = await this.participations.updateParticipationStatus({
        rideOfferId,
        participationId,
        actorUserId: driverUserId,
        status,
      });
      if (!participation) {
        throw new RideError(
          "RIDE_PARTICIPATION_STATUS_NOT_CHANGED",
          "Ride participation status could not be changed",
        );
      }
      return participation;
    });
  }

  private async requireOfferOwner(driverUserId: string, rideOfferId: string) {
    const offer = await this.offers.getForOwner(rideOfferId, driverUserId);
    if (!offer) {
      throw new RideError("RIDE_OFFER_MANAGE_FORBIDDEN", "Ride offer owner access required");
    }
    return offer;
  }

  private async requireRequestOwner(requesterUserId: string, rideRequestId: string) {
    const request = await this.requests.getForRequester(rideRequestId, requesterUserId);
    if (!request) {
      throw new RideError("RIDE_REQUEST_MANAGE_FORBIDDEN", "Ride request owner access required");
    }
    return request;
  }

  private async withRideOfferPresentations(
    offer: RideOfferForOwnerRecord,
  ): Promise<RideOfferForOwner> {
    const presentations = await this.userPresentations.findByUserIds(
      offer.participations.map((participation) => participation.passengerUserId),
    );
    const presentationByUserId = new Map(
      presentations.map((presentation) => [
        presentation.userId,
        {
          displayName: presentation.displayName,
          username: presentation.username,
          photoUrl: presentation.photoUrl,
        },
      ]),
    );
    return {
      ...offer,
      participations: offer.participations.map((participation) => ({
        ...participation,
        passenger: presentationByUserId.get(participation.passengerUserId) ?? null,
      })),
    };
  }

  private async validateDestination(
    destination: RideOfferCreateInput["destination"] | RideRequestCreateInput["destination"],
  ): Promise<void> {
    if (destination.type === "EVENT") {
      const event = await this.events.resolveRideDestinationEvent(destination.eventId);
      if (!event || event.status !== "PUBLISHED") {
        throw new RideError(
          "RIDE_DESTINATION_EVENT_NOT_FOUND",
          "Published Ride destination Event not found",
        );
      }
      return;
    }

    if (destination.type === "PLACE") {
      const place = await this.places.resolveRideDestinationPlace(destination.placeId);
      if (!place) {
        throw new RideError(
          "RIDE_DESTINATION_PLACE_NOT_FOUND",
          "Approved Ride destination Place not found",
        );
      }
    }
  }

  private async validateAudienceCommand(
    requesterUserId: string,
    audience: RideRequestCreateInput["audience"],
  ): Promise<void> {
    if (!audience || audience.scope === "GLOBAL") return;
    if (audience.selection === "ALL_CURRENT") {
      const communities =
        await this.communityMemberships.listActiveMembershipCommunities(requesterUserId);
      if (communities.length === 0) {
        throw new RideError(
          "RIDE_REQUEST_COMMUNITY_AUDIENCE_EMPTY",
          "Join or create a HOOMA to share this Ride request with a community",
        );
      }
      return;
    }
    const isMember = await this.communityMemberships.isActiveMemberOfCommunity(
      requesterUserId,
      audience.communityId,
    );
    if (!isMember) {
      throw new RideError(
        "RIDE_REQUEST_COMMUNITY_TARGET_FORBIDDEN",
        "Community target is not available for this Ride request",
      );
    }
  }

  private async withRidePolicy<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RidePolicyError) {
        throw new RideError(error.code, error.message);
      }
      throw error;
    }
  }

  private async removeOrScheduleVehiclePhotoObject(
    objectKey: string,
    reason: "REPLACED" | "DELETED" | "ORPHANED_AFTER_METADATA_FAILURE",
  ): Promise<void> {
    if (!this.storage) return this.vehiclePhotos.scheduleObjectDeletion({ objectKey, reason });
    try {
      await this.storage.remove(objectKey);
    } catch {
      await this.vehiclePhotos.scheduleObjectDeletion({ objectKey, reason });
    }
  }
}

function normalizeOfferListInput(input: PublicRideOfferListInput): RideOfferListInput {
  return { ...input, limit: normalizeLimit(input.limit) };
}

function normalizeRequestListInput(input: PublicRideRequestListInput): RideRequestListInput {
  return { ...input, limit: normalizeLimit(input.limit) };
}

function normalizeMineQuery(input: RideMineQuery): RideMineListQuery {
  return rideMineQuerySchema.parse(input);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

function normalizeVehiclePhotoContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function rideVehiclePhotoObjectKey(rideOfferId: string, photoId: string): string {
  return `ride-offer-vehicles/${rideOfferId}/${photoId}`;
}

function publicVehiclePhotoMetadata(photo: RideVehiclePhotoMetadata): RideVehiclePhotoMetadata {
  return {
    id: photo.id,
    rideOfferId: photo.rideOfferId,
    contentType: photo.contentType,
    sizeBytes: photo.sizeBytes,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}
