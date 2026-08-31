import type {
  RideCompensationTerms,
  PublicRideOffer,
  RideDestinationColumns,
  RideOfferStatus,
  RideParticipationStatus,
  RideRequestStatus,
} from "@hooma/contracts/rides";

export type RidePolicyErrorCode =
  | "RIDE_DESTINATION_REQUIRED"
  | "RIDE_DESTINATION_STRATEGY_CONFLICT"
  | "RIDE_DRIVER_CANNOT_PARTICIPATE"
  | "RIDE_COMPENSATION_INVALID"
  | "RIDE_COMPENSATION_PAYMENT_FORBIDDEN"
  | "RIDE_OFFER_STATUS_TRANSITION_INVALID"
  | "RIDE_REQUEST_STATUS_TRANSITION_INVALID"
  | "RIDE_PARTICIPATION_STATUS_TRANSITION_INVALID";

export class RidePolicyError extends Error {
  constructor(
    readonly code: RidePolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RidePolicyError";
  }
}

export const RIDE_OFFER_TERMINAL_STATUSES = ["CANCELLED", "COMPLETED"] as const;
export const RIDE_REQUEST_TERMINAL_STATUSES = ["CANCELLED", "EXPIRED", "COMPLETED"] as const;
export const RIDE_PARTICIPATION_TERMINAL_STATUSES = ["REJECTED", "CANCELLED", "COMPLETED"] as const;

const rideOfferTransitions: Record<RideOfferStatus, readonly RideOfferStatus[]> = {
  OPEN: ["FULL", "DEPARTED", "CANCELLED", "COMPLETED"],
  FULL: ["OPEN", "DEPARTED", "CANCELLED", "COMPLETED"],
  DEPARTED: ["COMPLETED"],
  CANCELLED: [],
  COMPLETED: [],
};

const rideRequestTransitions: Record<RideRequestStatus, readonly RideRequestStatus[]> = {
  OPEN: ["MATCHED", "CANCELLED", "EXPIRED", "COMPLETED"],
  MATCHED: ["CANCELLED", "EXPIRED", "COMPLETED"],
  CANCELLED: [],
  EXPIRED: [],
  COMPLETED: [],
};

const rideParticipationTransitions: Record<
  RideParticipationStatus,
  readonly RideParticipationStatus[]
> = {
  REQUESTED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["CANCELLED", "COMPLETED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export function rideDestinationStrategyCount(destination: RideDestinationColumns): number {
  return [
    destination.eventId,
    destination.destinationPlaceId,
    destination.customDestinationLabel,
  ].filter((value) => value !== undefined && value !== null).length;
}

export function assertSingleRideDestinationStrategy(destination: RideDestinationColumns): void {
  const count = rideDestinationStrategyCount(destination);
  if (count === 0) {
    throw new RidePolicyError(
      "RIDE_DESTINATION_REQUIRED",
      "Ride destination must use Event, Place, or custom destination",
    );
  }
  if (count > 1) {
    throw new RidePolicyError(
      "RIDE_DESTINATION_STRATEGY_CONFLICT",
      "Ride destination must use exactly one destination strategy",
    );
  }
}

export function assertDriverCanReceivePassenger(
  driverUserId: string,
  passengerUserId: string,
): void {
  if (driverUserId === passengerUserId) {
    throw new RidePolicyError(
      "RIDE_DRIVER_CANNOT_PARTICIPATE",
      "Ride driver cannot join their own offer as a passenger",
    );
  }
}

export function assertRideCompensationTerms(
  input: RideCompensationTerms & Record<string, unknown>,
): void {
  const hasPaymentProcessingField = [
    "paymentIntentId",
    "checkoutSessionId",
    "settlementId",
    "walletTransactionId",
    "cardPaymentId",
    "telegramStarsChargeId",
    "paidStatus",
    "paymentReceivedStatus",
  ].some((field) => field in input);
  if (hasPaymentProcessingField) {
    throw new RidePolicyError(
      "RIDE_COMPENSATION_PAYMENT_FORBIDDEN",
      "Ride compensation terms are advertised terms only; payment execution belongs to Payments",
    );
  }
  if (input.type === "CASH" && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) {
    throw new RidePolicyError(
      "RIDE_COMPENSATION_INVALID",
      "Ride CASH compensation terms require a positive integer minor-unit amount",
    );
  }
}

export function canTransitionRideOfferStatus(from: RideOfferStatus, to: RideOfferStatus): boolean {
  return from === to || rideOfferTransitions[from].includes(to);
}

export function assertRideOfferStatusTransition(from: RideOfferStatus, to: RideOfferStatus): void {
  if (!canTransitionRideOfferStatus(from, to)) {
    throw new RidePolicyError(
      "RIDE_OFFER_STATUS_TRANSITION_INVALID",
      `Ride Offer cannot transition from ${from} to ${to}`,
    );
  }
}

export function canTransitionRideRequestStatus(
  from: RideRequestStatus,
  to: RideRequestStatus,
): boolean {
  return from === to || rideRequestTransitions[from].includes(to);
}

export function assertRideRequestStatusTransition(
  from: RideRequestStatus,
  to: RideRequestStatus,
): void {
  if (!canTransitionRideRequestStatus(from, to)) {
    throw new RidePolicyError(
      "RIDE_REQUEST_STATUS_TRANSITION_INVALID",
      `Ride Request cannot transition from ${from} to ${to}`,
    );
  }
}

export function canTransitionRideParticipationStatus(
  from: RideParticipationStatus,
  to: RideParticipationStatus,
): boolean {
  return from === to || rideParticipationTransitions[from].includes(to);
}

export function assertRideParticipationStatusTransition(
  from: RideParticipationStatus,
  to: RideParticipationStatus,
): void {
  if (!canTransitionRideParticipationStatus(from, to)) {
    throw new RidePolicyError(
      "RIDE_PARTICIPATION_STATUS_TRANSITION_INVALID",
      `Ride Participation cannot transition from ${from} to ${to}`,
    );
  }
}

export interface RidePublicOfferProjectionInput extends PublicRideOffer {
  readonly driverUserId?: string;
  readonly exactMeetingPoint?: unknown;
  readonly meetingPoint?: unknown;
  readonly participations?: unknown;
}

export function toPublicRideOffer(input: RidePublicOfferProjectionInput): PublicRideOffer {
  return {
    id: input.id,
    status: input.status,
    destination: input.destination,
    originAreaLabel: input.originAreaLabel,
    departureAt: input.departureAt,
    totalSeats: input.totalSeats,
    availableSeats: input.availableSeats,
    vehicleMake: input.vehicleMake,
    vehicleModel: input.vehicleModel,
    vehicleColor: input.vehicleColor,
    note: input.note,
    hasVehiclePhoto: input.hasVehiclePhoto,
    waypoints: input.waypoints,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function canViewRideMeetingPoint(input: {
  readonly viewerUserId: string | null;
  readonly driverUserId: string;
  readonly acceptedPassengerUserId: string;
}): boolean {
  return (
    input.viewerUserId === input.driverUserId ||
    input.viewerUserId === input.acceptedPassengerUserId
  );
}
