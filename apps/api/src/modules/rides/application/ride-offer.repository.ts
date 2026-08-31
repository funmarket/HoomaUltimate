import type {
  PublicRideOffer,
  PublicRideOfferList,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideOfferCreateInput,
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

export type RideOfferForOwnerRecord = PublicRideOffer & {
  readonly driverUserId: string;
  readonly participations: readonly RideParticipation[];
};

export interface RideOfferRepository {
  listPublic(input: RideOfferListInput): Promise<PublicRideOfferList>;
  getPublic(rideOfferId: string): Promise<PublicRideOffer | null>;
  getForOwner(rideOfferId: string, driverUserId: string): Promise<RideOfferForOwnerRecord | null>;
  create(driverUserId: string, input: RideOfferCreateInput): Promise<RideOfferForOwnerRecord>;
  update(
    rideOfferId: string,
    driverUserId: string,
    input: RideOfferUpdateInput,
  ): Promise<RideOfferForOwnerRecord | null>;
  updateStatus(
    rideOfferId: string,
    driverUserId: string,
    status: RideOfferStatus,
  ): Promise<RideOfferForOwnerRecord | null>;
}

export interface RideParticipationRepository {
  getForPassenger(rideOfferId: string, passengerUserId: string): Promise<RideParticipation | null>;
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
