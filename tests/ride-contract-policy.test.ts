import assert from "node:assert/strict";
import test from "node:test";
import {
  publicRideOfferSchema,
  publicRideRequestSchema,
  rideCompensationTermsSchema,
  rideOfferCompensationTermsSchema,
  rideContextSchema,
  rideDestinationColumnsSchema,
  rideOfferCreateSchema,
  rideRequestCompensationTermsSchema,
  rideRequestCreateSchema,
} from "../packages/contracts/src/rides.js";
import {
  RidePolicyError,
  assertDriverCanReceivePassenger,
  assertRideCompensationTerms,
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
    context: "MATCHDAY" as const,
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
    compensationTerms: { type: "FREE" as const },
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
      context: "MATCHDAY",
      destination: { type: "EVENT", eventId: "event-1" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
      compensationTerms: { type: "FREE" },
    }).success,
    true,
  );

  assert.equal(
    rideOfferCreateSchema.safeParse({
      context: "GENERAL",
      destination: { type: "CUSTOM", customDestinationLabel: "Stadium Gate 4" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
      compensationTerms: { type: "FREE" },
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

test("Ride context contract accepts Matchday and General without splitting Ride", () => {
  assert.equal(rideContextSchema.safeParse("MATCHDAY").success, true);
  assert.equal(rideContextSchema.safeParse("GENERAL").success, true);
  assert.equal(rideContextSchema.safeParse("ANYWHERE").success, false);
  assert.equal(rideContextSchema.safeParse("MATCHDAY_RIDE").success, false);
});

test("Ride offer contract requires advertised FREE or CASH compensation terms", () => {
  assert.equal(
    rideOfferCreateSchema.safeParse({
      context: "GENERAL",
      destination: { type: "PLACE", placeId: "place-1" },
      originAreaLabel: "La Marsa",
      departureAt: now,
      totalSeats: 3,
      compensationTerms: { type: "FREE" },
    }).success,
    true,
  );

  assert.equal(
    rideOfferCreateSchema.safeParse({
      context: "MATCHDAY",
      destination: { type: "EVENT", eventId: "event-1" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
      compensationTerms: {
        type: "CASH",
        amountMinor: 10000,
        currency: "TND",
        basis: "PER_SEAT",
      },
    }).success,
    true,
  );

  assert.equal(
    rideOfferCreateSchema.safeParse({
      context: "GENERAL",
      destination: { type: "CUSTOM", customDestinationLabel: "Airport" },
      originAreaLabel: "Marsa",
      departureAt: now,
      totalSeats: 1,
      compensationTerms: {
        type: "CASH",
        amountMinor: 10000,
        currency: "TND",
      },
    }).success,
    false,
  );

  assert.equal(
    rideOfferCreateSchema.safeParse({
      context: "MATCHDAY",
      destination: { type: "EVENT", eventId: "event-1" },
      originAreaLabel: "Menzah",
      departureAt: now,
      totalSeats: 2,
      compensationTerms: {
        type: "CASH",
        amountMinor: 10000,
        currency: "TND",
        basis: "PER_SEAT",
        paymentIntentId: "pi_1",
      },
    }).success,
    false,
  );
});

test("Ride offer compensation contract accepts only supported cash currencies", () => {
  for (const currency of ["TND", "EUR", "USD"] as const) {
    assert.equal(
      rideOfferCompensationTermsSchema.safeParse({
        type: "CASH",
        amountMinor: 1000,
        currency,
        basis: "PER_SEAT",
      }).success,
      true,
    );
  }

  for (const currency of ["GBP", "JPY", "XYZ"] as const) {
    assert.equal(
      rideOfferCompensationTermsSchema.safeParse({
        type: "CASH",
        amountMinor: 1000,
        currency,
        basis: "TOTAL",
      }).success,
      false,
    );
  }
});

test("Ride request compensation contract accepts only supported cash currencies", () => {
  for (const currency of ["TND", "EUR", "USD"] as const) {
    assert.equal(
      rideRequestCompensationTermsSchema.safeParse({
        type: "CASH",
        amountMinor: 1000,
        currency,
      }).success,
      true,
    );
  }

  for (const currency of ["GBP", "JPY", "XYZ"] as const) {
    assert.equal(
      rideRequestCompensationTermsSchema.safeParse({
        type: "CASH",
        amountMinor: 1000,
        currency,
      }).success,
      false,
    );
  }
});

test("Ride request contract supports no cash offer or advertised cash offer only", () => {
  assert.equal(
    rideRequestCreateSchema.safeParse({
      context: "GENERAL",
      destination: { type: "CUSTOM", customDestinationLabel: "Airport" },
      pickupAreaLabel: "La Marsa",
      desiredDepartureAt: now,
      passengerCount: 1,
      expiresAt: now,
      compensationTerms: { type: "FREE" },
    }).success,
    true,
  );

  assert.equal(
    rideRequestCreateSchema.safeParse({
      context: "MATCHDAY",
      destination: { type: "EVENT", eventId: "event-1" },
      pickupAreaLabel: "Menzah",
      desiredDepartureAt: now,
      passengerCount: 2,
      expiresAt: now,
      compensationTerms: { type: "CASH", amountMinor: 8000, currency: "TND" },
    }).success,
    true,
  );

  assert.equal(
    rideCompensationTermsSchema.safeParse({
      type: "PAYMENT_INTENT",
      amountMinor: 8000,
      currency: "TND",
    }).success,
    false,
  );

  assert.equal(
    rideRequestCreateSchema.safeParse({
      context: "GENERAL",
      destination: { type: "CUSTOM", customDestinationLabel: "Airport" },
      pickupAreaLabel: "Menzah",
      desiredDepartureAt: now,
      passengerCount: 2,
      expiresAt: now,
      compensationTerms: {
        type: "CASH",
        amountMinor: 8000,
        currency: "TND",
        paymentIntentId: "pi_1",
      },
    }).success,
    false,
  );
});

test("Ride public projections exclude payment processing state", () => {
  const publicOffer = validPublicOffer();
  assert.equal(publicRideOfferSchema.safeParse(publicOffer).success, true);
  assert.equal("paymentIntentId" in publicOffer, false);
  assert.equal("paidStatus" in publicOffer, false);

  const publicRequest = {
    id: "ride-request-1",
    context: "GENERAL" as const,
    status: "OPEN" as const,
    destination: { type: "CUSTOM" as const, label: "Airport" },
    pickupAreaLabel: "La Marsa",
    desiredDepartureAt: now,
    passengerCount: 1,
    compensationTerms: { type: "FREE" as const },
    note: null,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
  };
  assert.equal(publicRideRequestSchema.safeParse(publicRequest).success, true);
  assert.equal("paymentIntentId" in publicRequest, false);
  assert.equal("paidStatus" in publicRequest, false);
});

test("Ride compensation policy rejects processing and malformed cash terms", () => {
  assert.doesNotThrow(() => assertRideCompensationTerms({ type: "FREE" }));
  assert.doesNotThrow(() =>
    assertRideCompensationTerms({ type: "CASH", amountMinor: 10000, currency: "TND" }),
  );
  assert.throws(
    () => assertRideCompensationTerms({ type: "CASH", amountMinor: 0, currency: "TND" }),
    (error: unknown) =>
      error instanceof RidePolicyError && error.code === "RIDE_COMPENSATION_INVALID",
  );
  assert.throws(
    () =>
      assertRideCompensationTerms({
        type: "CASH",
        amountMinor: 10000,
        currency: "TND",
        paymentIntentId: "pi_1",
      }),
    (error: unknown) =>
      error instanceof RidePolicyError && error.code === "RIDE_COMPENSATION_PAYMENT_FORBIDDEN",
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
