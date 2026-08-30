import type {
  PublicRideOffer,
  PublicRideOfferList,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideOfferStatus,
  RideOfferUpdateInput,
  RideParticipation,
  RideParticipationRequestInput,
  RideParticipationStatus,
} from "@hooma/contracts/rides";

export interface RideOfferListInput {
  readonly limit: number;
  readonly cursor?: string;
  readonly eventId?: string;
  readonly destinationPlaceId?: string;
  readonly from?: Date;
}

export interface RideOfferRepository {
  listPublic(input: RideOfferListInput): Promise<PublicRideOfferList>;
  getPublic(rideOfferId: string): Promise<PublicRideOffer | null>;
  getForOwner(rideOfferId: string, driverUserId: string): Promise<RideOfferForOwner | null>;
  create(driverUserId: string, input: RideOfferCreateInput): Promise<RideOfferForOwner>;
  update(
    rideOfferId: string,
    driverUserId: string,
    input: RideOfferUpdateInput,
  ): Promise<RideOfferForOwner | null>;
  updateStatus(
    rideOfferId: string,
    driverUserId: string,
    status: RideOfferStatus,
  ): Promise<RideOfferForOwner | null>;
}

export interface RideParticipationRepository {
  requestParticipation(
    rideOfferId: string,
    passengerUserId: string,
    input: RideParticipationRequestInput,
  ): Promise<RideParticipation | null>;
  updateParticipationStatus(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly actorUserId: string;
    readonly status: RideParticipationStatus;
  }): Promise<RideParticipation | null>;
}

export interface RideMeetingPointRepository {
  upsertForParticipation(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly driverUserId: string;
    readonly meetingPoint: RideMeetingPointInput;
  }): Promise<RideMeetingPoint | null>;
  getForAuthorizedViewer(input: {
    readonly participationId: string;
    readonly viewerUserId: string;
  }): Promise<RideMeetingPoint | null>;
}
