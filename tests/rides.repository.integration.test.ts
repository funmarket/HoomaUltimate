import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import {
  PrismaRideOfferRepository,
  PrismaRideRequestRepository,
} from "../apps/api/src/modules/rides/infrastructure/prisma-ride.repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Ride repository integration tests");

const db = getDatabaseClient();
const offerRepository = new PrismaRideOfferRepository(db);
const requestRepository = new PrismaRideRequestRepository(db);

test("Ride participation acceptance serializes final-seat capacity and cannot overbook", async () => {
  const fixture = await createRideFixture({ totalSeats: 1, passengerCount: 2 });

  try {
    const [firstRequest, secondRequest] = await Promise.all([
      offerRepository.requestParticipation(fixture.offer.id, fixture.passengers[0]!.id, {
        seatCount: 1,
      }),
      offerRepository.requestParticipation(fixture.offer.id, fixture.passengers[1]!.id, {
        seatCount: 1,
      }),
    ]);
    assert.ok(firstRequest);
    assert.ok(secondRequest);

    const attempts = await Promise.allSettled([
      offerRepository.updateParticipationStatus({
        rideOfferId: fixture.offer.id,
        participationId: firstRequest.id,
        actorUserId: fixture.driver.id,
        status: "ACCEPTED",
      }),
      offerRepository.updateParticipationStatus({
        rideOfferId: fixture.offer.id,
        participationId: secondRequest.id,
        actorUserId: fixture.driver.id,
        status: "ACCEPTED",
      }),
    ]);

    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 0);
    const fulfilled = attempts.map((attempt) =>
      attempt.status === "fulfilled" ? attempt.value : null,
    );
    assert.equal(
      fulfilled.filter((participation) => participation?.status === "ACCEPTED").length,
      1,
    );

    const acceptedSeats = await db.rideParticipation.aggregate({
      where: { rideOfferId: fixture.offer.id, status: "ACCEPTED" },
      _sum: { seatCount: true },
      _count: true,
    });
    assert.equal(acceptedSeats._sum.seatCount, 1);
    assert.equal(acceptedSeats._count, 1);

    const storedOffer = await db.rideOffer.findUniqueOrThrow({ where: { id: fixture.offer.id } });
    assert.equal(storedOffer.status, "FULL");

    const publicOffer = await offerRepository.getPublic(fixture.offer.id);
    assert.equal(publicOffer?.availableSeats, 0);
  } finally {
    await cleanupRideFixture(fixture);
  }
});

test("Ride participation request is idempotent per offer/passenger identity", async () => {
  const fixture = await createRideFixture({ totalSeats: 2, passengerCount: 1 });

  try {
    const attempts = await Promise.allSettled([
      offerRepository.requestParticipation(fixture.offer.id, fixture.passengers[0]!.id, {
        seatCount: 1,
      }),
      offerRepository.requestParticipation(fixture.offer.id, fixture.passengers[0]!.id, {
        seatCount: 1,
      }),
    ]);

    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 0);
    assert.equal(
      await db.rideParticipation.count({
        where: { rideOfferId: fixture.offer.id, passengerUserId: fixture.passengers[0]!.id },
      }),
      1,
    );
  } finally {
    await cleanupRideFixture(fixture);
  }
});

test("Ride participation cancellation releases capacity according to policy", async () => {
  const fixture = await createRideFixture({ totalSeats: 1, passengerCount: 2 });

  try {
    const firstRequest = await offerRepository.requestParticipation(
      fixture.offer.id,
      fixture.passengers[0]!.id,
      { seatCount: 1 },
    );
    assert.ok(firstRequest);

    const accepted = await offerRepository.updateParticipationStatus({
      rideOfferId: fixture.offer.id,
      participationId: firstRequest.id,
      actorUserId: fixture.driver.id,
      status: "ACCEPTED",
    });
    assert.equal(accepted?.status, "ACCEPTED");
    assert.equal(
      (await db.rideOffer.findUniqueOrThrow({ where: { id: fixture.offer.id } })).status,
      "FULL",
    );

    const cancelled = await offerRepository.updateParticipationStatus({
      rideOfferId: fixture.offer.id,
      participationId: firstRequest.id,
      actorUserId: fixture.passengers[0]!.id,
      status: "CANCELLED",
    });
    assert.equal(cancelled?.status, "CANCELLED");
    assert.equal(
      (await db.rideOffer.findUniqueOrThrow({ where: { id: fixture.offer.id } })).status,
      "OPEN",
    );

    const secondRequest = await offerRepository.requestParticipation(
      fixture.offer.id,
      fixture.passengers[1]!.id,
      { seatCount: 1 },
    );
    assert.ok(secondRequest);

    const secondAccepted = await offerRepository.updateParticipationStatus({
      rideOfferId: fixture.offer.id,
      participationId: secondRequest.id,
      actorUserId: fixture.driver.id,
      status: "ACCEPTED",
    });
    assert.equal(secondAccepted?.status, "ACCEPTED");

    assert.equal(
      await db.rideParticipation.count({
        where: { rideOfferId: fixture.offer.id, status: "ACCEPTED" },
      }),
      1,
    );
  } finally {
    await cleanupRideFixture(fixture);
  }
});

test("Ride repository rejects terminal lifecycle rewrites", async () => {
  const fixture = await createRideFixture({ totalSeats: 1, passengerCount: 0 });
  const requester = await db.user.create({ data: {} });
  const request = await requestRepository.create(requester.id, {
    destination: { type: "CUSTOM", customDestinationLabel: "Stade Chedly Zouiten" },
    pickupAreaLabel: "Bab Saadoun",
    desiredDepartureAt: futureDate(90).toISOString(),
    passengerCount: 1,
    expiresAt: futureDate(30).toISOString(),
    note: null,
  });

  try {
    await offerRepository.updateStatus(fixture.offer.id, fixture.driver.id, "CANCELLED");
    await assert.rejects(
      () => offerRepository.updateStatus(fixture.offer.id, fixture.driver.id, "OPEN"),
      /Ride Offer cannot transition from CANCELLED to OPEN/,
    );

    await requestRepository.updateStatus(request.id, requester.id, "CANCELLED");
    await assert.rejects(
      () => requestRepository.updateStatus(request.id, requester.id, "OPEN"),
      /Ride Request cannot transition from CANCELLED to OPEN/,
    );
  } finally {
    await cleanupRideFixture({ ...fixture, extraUserIds: [requester.id] });
    await db.rideRequest.deleteMany({ where: { id: request.id } });
  }
});

test("Ride meeting points stay private to the driver and accepted passenger", async () => {
  const fixture = await createRideFixture({ totalSeats: 1, passengerCount: 2 });

  try {
    const request = await offerRepository.requestParticipation(
      fixture.offer.id,
      fixture.passengers[0]!.id,
      { seatCount: 1 },
    );
    assert.ok(request);

    const accepted = await offerRepository.updateParticipationStatus({
      rideOfferId: fixture.offer.id,
      participationId: request.id,
      actorUserId: fixture.driver.id,
      status: "ACCEPTED",
    });
    assert.equal(accepted?.status, "ACCEPTED");

    const meetingPoint = await offerRepository.upsertForParticipation({
      rideOfferId: fixture.offer.id,
      participationId: request.id,
      driverUserId: fixture.driver.id,
      meetingPoint: {
        label: "Gate 3 beside the blue kiosk",
        latitude: 36.8065,
        longitude: 10.1815,
      },
    });
    assert.ok(meetingPoint);

    const publicOffer = await offerRepository.getPublic(fixture.offer.id);
    assert.ok(publicOffer);
    const publicRecord = publicOffer as unknown as Record<string, unknown>;
    assert.equal("driverUserId" in publicRecord, false);
    assert.equal("participations" in publicRecord, false);
    assert.equal("meetingPoint" in publicRecord, false);
    assert.equal(JSON.stringify(publicRecord).includes("Gate 3 beside the blue kiosk"), false);

    const driverView = await offerRepository.getForAuthorizedViewer({
      participationId: request.id,
      viewerUserId: fixture.driver.id,
    });
    const passengerView = await offerRepository.getForAuthorizedViewer({
      participationId: request.id,
      viewerUserId: fixture.passengers[0]!.id,
    });
    const outsiderView = await offerRepository.getForAuthorizedViewer({
      participationId: request.id,
      viewerUserId: fixture.passengers[1]!.id,
    });

    assert.equal(driverView?.label, meetingPoint.label);
    assert.equal(passengerView?.label, meetingPoint.label);
    assert.equal(outsiderView, null);
  } finally {
    await cleanupRideFixture(fixture);
  }
});

test("Ride request repository persists owner/public state without exposing requester identity", async () => {
  const requester = await db.user.create({ data: {} });
  const request = await requestRepository.create(requester.id, {
    destination: { type: "CUSTOM", customDestinationLabel: "El Menzah Stadium" },
    pickupAreaLabel: "Ariana",
    desiredDepartureAt: futureDate(90).toISOString(),
    passengerCount: 2,
    expiresAt: futureDate(30).toISOString(),
    note: "Can leave after work.",
  });

  try {
    const publicList = await requestRepository.listPublic({ limit: 10 });
    assert.ok(publicList.items.some((item) => item.id === request.id));

    const publicRequest = await requestRepository.getPublic(request.id);
    assert.ok(publicRequest);
    const publicRecord = publicRequest as unknown as Record<string, unknown>;
    assert.equal("requesterUserId" in publicRecord, false);

    const ownerRequest = await requestRepository.getForRequester(request.id, requester.id);
    assert.equal(ownerRequest?.requesterUserId, requester.id);

    const updated = await requestRepository.update(request.id, requester.id, {
      pickupAreaLabel: "Ariana Centre",
      passengerCount: 1,
      note: null,
    });
    assert.equal(updated?.pickupAreaLabel, "Ariana Centre");
    assert.equal(updated?.passengerCount, 1);
    assert.equal(updated?.note, null);

    const cancelled = await requestRepository.updateStatus(request.id, requester.id, "CANCELLED");
    assert.equal(cancelled?.status, "CANCELLED");
    assert.equal(await requestRepository.getPublic(request.id), null);
  } finally {
    await db.rideRequest.deleteMany({ where: { id: request.id } });
    await db.user.deleteMany({ where: { id: requester.id } });
  }
});

interface RideFixture {
  readonly driver: { readonly id: string };
  readonly passengers: ReadonlyArray<{ readonly id: string }>;
  readonly offer: { readonly id: string };
  readonly extraUserIds?: readonly string[];
}

async function createRideFixture(input: {
  readonly totalSeats: number;
  readonly passengerCount: number;
}): Promise<RideFixture> {
  const driver = await db.user.create({ data: {} });
  const passengers = await Promise.all(
    Array.from({ length: input.passengerCount }, () => db.user.create({ data: {} })),
  );
  const offer = await offerRepository.create(driver.id, {
    destination: { type: "CUSTOM", customDestinationLabel: "Stade Olympique de Rades" },
    originAreaLabel: "Lac 2",
    departureAt: futureDate(60).toISOString(),
    totalSeats: input.totalSeats,
    vehicleMake: "Dacia",
    vehicleModel: "Sandero",
    vehicleColor: "White",
    note: null,
    waypoints: [
      { sequence: 0, areaLabel: "Aouina", placeId: null },
      { sequence: 1, areaLabel: "Charguia", placeId: null },
    ],
  });

  return { driver, passengers, offer };
}

async function cleanupRideFixture(fixture: RideFixture): Promise<void> {
  await db.rideMeetingPoint.deleteMany({
    where: { participation: { rideOfferId: fixture.offer.id } },
  });
  await db.rideParticipation.deleteMany({ where: { rideOfferId: fixture.offer.id } });
  await db.rideOfferWaypoint.deleteMany({ where: { rideOfferId: fixture.offer.id } });
  await db.rideOffer.deleteMany({ where: { id: fixture.offer.id } });
  await db.user.deleteMany({
    where: {
      id: {
        in: [
          fixture.driver.id,
          ...fixture.passengers.map((passenger) => passenger.id),
          ...(fixture.extraUserIds ?? []),
        ],
      },
    },
  });
}

function futureDate(minutesFromNow: number): Date {
  return new Date(Date.now() + minutesFromNow * 60_000);
}
