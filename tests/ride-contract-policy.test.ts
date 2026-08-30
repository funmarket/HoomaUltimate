import assert from "node:assert/strict";
import test from "node:test";
import {
  publicRideOfferSchema,
  rideDestinationColumnsSchema,
  rideOfferCreateSchema,
} from "../packages/contracts/src/rides.js";
import {
  RidePolicyError,
  assertDriverCanReceivePassenger,
  assertSingleRideDestinationStrategy,
  canTransitionRideOfferStatus,
  canTransitionRideParticipationStatus,
  canViewRideMeetingPoint,
  toPublicRideOffer,
} from "../apps/api/src/modules/rides/domain/ride-policy.js";

const now = "2026-08-30T12:00:00.000Z";

function validPublicOffer() {
  return {
    id: "ride-offer-1",
    status: "OPEN" as const,
    destination: {
      type: "EVENT" as const,
      eventId: "event-1",
      title: "Derby night",
      startsAt: now,
    },
    originAreaLabel: "La Marsa",
    departureAt: now,
    totalSeats: 3,
    availableSeats: 2,
    vehicleMake: "Peugeot",
    vehicleModel: "208",
    vehicleColor: "Black",
    note: null,
    hasVehiclePhoto: false,
    waypoints: [],
    createdAt: now,
    updatedAt: now,
  };
}

test("Ride offer create contract accepts exactly one destination strategy", () => {
  assert.equal(
    rideOfferCreateSchema.safeParse({
      destination: { type: "EVENT", eventId: "event-1" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
    }).success,
    true,
  );

  assert.equal(
    rideOfferCreateSchema.safeParse({
      destination: { type: "CUSTOM", customDestinationLabel: "Stadium Gate 4" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
    }).success,
    true,
  );

  assert.equal(
    rideDestinationColumnsSchema.safeParse({
      eventId: "event-1",
      destinationPlaceId: "place-1",
      customDestinationLabel: null,
    }).success,
    false,
  );
});

test("Ride domain policy rejects missing or conflicting destination columns", () => {
  assert.throws(
    () =>
      assertSingleRideDestinationStrategy({
        eventId: null,
        destinationPlaceId: null,
        customDestinationLabel: null,
      }),
    (error: unknown) =>
      error instanceof RidePolicyError && error.code === "RIDE_DESTINATION_REQUIRED",
  );

  assert.throws(
    () =>
      assertSingleRideDestinationStrategy({
        eventId: "event-1",
        destinationPlaceId: "place-1",
        customDestinationLabel: null,
      }),
    (error: unknown) =>
      error instanceof RidePolicyError && error.code === "RIDE_DESTINATION_STRATEGY_CONFLICT",
  );
});

test("Ride policy forbids driver self-participation", () => {
  assert.doesNotThrow(() => assertDriverCanReceivePassenger("driver-1", "passenger-1"));
  assert.throws(
    () => assertDriverCanReceivePassenger("driver-1", "driver-1"),
    (error: unknown) =>
      error instanceof RidePolicyError && error.code === "RIDE_DRIVER_CANNOT_PARTICIPATE",
  );
});

test("Ride lifecycle policy keeps terminal states closed", () => {
  assert.equal(canTransitionRideOfferStatus("OPEN", "FULL"), true);
  assert.equal(canTransitionRideOfferStatus("CANCELLED", "OPEN"), false);
  assert.equal(canTransitionRideParticipationStatus("REQUESTED", "ACCEPTED"), true);
  assert.equal(canTransitionRideParticipationStatus("COMPLETED", "ACCEPTED"), false);
});

test("Ride public offer projection strips private owner and meeting-point data", () => {
  const publicOffer = toPublicRideOffer({
    ...validPublicOffer(),
    driverUserId: "driver-1",
    exactMeetingPoint: { label: "Private door" },
    participations: [{ passengerUserId: "passenger-1" }],
  });

  assert.equal(publicRideOfferSchema.safeParse(publicOffer).success, true);
  assert.equal("driverUserId" in publicOffer, false);
  assert.equal("exactMeetingPoint" in publicOffer, false);
  assert.equal("participations" in publicOffer, false);
});

test("Ride meeting point visibility is limited to driver and accepted passenger", () => {
  assert.equal(
    canViewRideMeetingPoint({
      viewerUserId: "driver-1",
      driverUserId: "driver-1",
      acceptedPassengerUserId: "passenger-1",
    }),
    true,
  );
  assert.equal(
    canViewRideMeetingPoint({
      viewerUserId: "passenger-1",
      driverUserId: "driver-1",
      acceptedPassengerUserId: "passenger-1",
    }),
    true,
  );
  assert.equal(
    canViewRideMeetingPoint({
      viewerUserId: "other-passenger",
      driverUserId: "driver-1",
      acceptedPassengerUserId: "passenger-1",
    }),
    false,
  );
  assert.equal(
    canViewRideMeetingPoint({
      viewerUserId: null,
      driverUserId: "driver-1",
      acceptedPassengerUserId: "passenger-1",
    }),
    false,
  );
});
