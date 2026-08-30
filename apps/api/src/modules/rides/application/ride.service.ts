import type {
  RideMeetingPointInput,
  RideOfferCreateInput,
  RideOfferStatus,
  RideOfferUpdateInput,
  RideParticipationRequestInput,
  RideParticipationStatus,
  RideRequestCreateInput,
  RideRequestStatus,
  RideRequestUpdateInput,
} from "@hooma/contracts/rides";
import { RideError } from "../domain/ride-error.js";
import { RidePolicyError } from "../domain/ride-policy.js";
import type {
  RideMeetingPointRepository,
  RideOfferListInput,
  RideOfferRepository,
  RideParticipationRepository,
} from "./ride-offer.repository.js";
import type {
  RideEventReferenceReader,
  RidePlaceReferenceReader,
} from "./ride-reference.readers.js";
import type { RideRequestListInput, RideRequestRepository } from "./ride-request.repository.js";

type PublicRideOfferListInput = Omit<RideOfferListInput, "limit"> & { readonly limit?: number };
type PublicRideRequestListInput = Omit<RideRequestListInput, "limit"> & { readonly limit?: number };

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export class RideService {
  constructor(
    private readonly offers: RideOfferRepository,
    private readonly requests: RideRequestRepository,
    private readonly participations: RideParticipationRepository,
    private readonly meetingPoints: RideMeetingPointRepository,
    private readonly events: RideEventReferenceReader,
    private readonly places: RidePlaceReferenceReader,
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
    return this.requireOfferOwner(driverUserId, rideOfferId);
  }

  async createOffer(driverUserId: string, input: RideOfferCreateInput) {
    await this.validateDestination(input.destination);
    return this.withRidePolicy(() => this.offers.create(driverUserId, input));
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
      return updated;
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
    return this.withRidePolicy(() => this.requests.create(requesterUserId, input));
  }

  async updateRequest(
    requesterUserId: string,
    rideRequestId: string,
    input: RideRequestUpdateInput,
  ) {
    await this.requireRequestOwner(requesterUserId, rideRequestId);
    if (input.destination) await this.validateDestination(input.destination);

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
      return updated;
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
}

function normalizeOfferListInput(input: PublicRideOfferListInput): RideOfferListInput {
  return { ...input, limit: normalizeLimit(input.limit) };
}

function normalizeRequestListInput(input: PublicRideRequestListInput): RideRequestListInput {
  return { ...input, limit: normalizeLimit(input.limit) };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}
