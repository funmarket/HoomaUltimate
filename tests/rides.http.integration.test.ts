import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Ride HTTP integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

async function register(base: string, username: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      password: "correct horse battery staple",
      displayUsername: username,
      displayName: username,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const credential = await db.webCredential.findUniqueOrThrow({
    where: { loginUsername: username },
  });
  return { cookie, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function futureDate(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

test("Ride HTTP APIs expose public/member flows without leaking private Ride state", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const createdUserIds: string[] = [];
  let rideOfferId: string | null = null;
  let rideRequestId: string | null = null;

  try {
    const protectedOffer = await fetch(`${base}/api/v1/rides/offers`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({}),
    });
    assert.equal(protectedOffer.status, 401);

    const suffix = Date.now().toString(36);
    const driver = await register(base, `ride_driver_${suffix}`);
    const passenger = await register(base, `ride_passenger_${suffix}`);
    const outsider = await register(base, `ride_outsider_${suffix}`);
    const requester = await register(base, `ride_requester_${suffix}`);
    createdUserIds.push(driver.userId, passenger.userId, outsider.userId, requester.userId);

    const createOffer = await fetch(`${base}/api/v1/rides/offers`, {
      method: "POST",
      headers: headers(driver.cookie),
      body: JSON.stringify({
        destination: { type: "CUSTOM", customDestinationLabel: "Stade Olympique de Rades" },
        originAreaLabel: "Lac 2",
        departureAt: futureDate(90),
        totalSeats: 1,
        vehicleMake: "Dacia",
        vehicleModel: "Sandero",
        vehicleColor: "White",
        note: "Leaving after work.",
        waypoints: [{ sequence: 0, areaLabel: "Aouina", placeId: null }],
      }),
    });
    assert.equal(createOffer.status, 201);
    const offer = (await createOffer.json()) as {
      id: string;
      driverUserId: string;
      participations: unknown[];
    };
    rideOfferId = offer.id;
    assert.equal(offer.driverUserId, driver.userId);
    assert.deepEqual(offer.participations, []);
    assert.equal(
      (await db.rideOffer.findUniqueOrThrow({ where: { id: offer.id } })).driverUserId,
      driver.userId,
    );

    const publicOfferList = await fetch(`${base}/api/public/v1/rides/offers?limit=5`);
    assert.equal(publicOfferList.status, 200);
    const publicOffers = (await publicOfferList.json()) as { items: Record<string, unknown>[] };
    const publicOffer = publicOffers.items.find((item) => item.id === offer.id);
    assert.ok(publicOffer);
    assert.equal("driverUserId" in publicOffer, false);
    assert.equal("participations" in publicOffer, false);
    assert.equal("meetingPoint" in publicOffer, false);

    const publicOfferDetail = await fetch(`${base}/api/public/v1/rides/offers/${offer.id}`);
    assert.equal(publicOfferDetail.status, 200);
    assert.equal(
      "driverUserId" in ((await publicOfferDetail.json()) as Record<string, unknown>),
      false,
    );

    const nonOwnerPatch = await fetch(`${base}/api/v1/rides/offers/${offer.id}`, {
      method: "PATCH",
      headers: headers(passenger.cookie),
      body: JSON.stringify({ originAreaLabel: "Not mine" }),
    });
    assert.equal(nonOwnerPatch.status, 403);
    assert.equal(
      ((await nonOwnerPatch.json()) as { error: { code: string } }).error.code,
      "RIDE_OFFER_MANAGE_FORBIDDEN",
    );

    const join = await fetch(`${base}/api/v1/rides/offers/${offer.id}/participations`, {
      method: "POST",
      headers: headers(passenger.cookie),
      body: JSON.stringify({ seatCount: 1 }),
    });
    assert.equal(join.status, 201);
    const participation = (await join.json()) as {
      id: string;
      passengerUserId: string;
      status: string;
    };
    assert.equal(participation.passengerUserId, passenger.userId);
    assert.equal(participation.status, "REQUESTED");

    const accept = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/${participation.id}/accept`,
      { method: "POST", headers: headers(driver.cookie) },
    );
    assert.equal(accept.status, 200);
    assert.equal(((await accept.json()) as { status: string }).status, "ACCEPTED");

    const meetingPoint = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/${participation.id}/meeting-point`,
      {
        method: "PUT",
        headers: headers(driver.cookie),
        body: JSON.stringify({
          label: "Gate 3 beside the blue kiosk",
          latitude: 36.8065,
          longitude: 10.1815,
        }),
      },
    );
    assert.equal(meetingPoint.status, 200);
    assert.equal(
      ((await meetingPoint.json()) as { label: string }).label,
      "Gate 3 beside the blue kiosk",
    );

    const passengerMeetingPoint = await fetch(
      `${base}/api/v1/rides/participations/${participation.id}/meeting-point`,
      { headers: headers(passenger.cookie) },
    );
    assert.equal(passengerMeetingPoint.status, 200);
    assert.equal(
      ((await passengerMeetingPoint.json()) as { label: string }).label,
      "Gate 3 beside the blue kiosk",
    );

    const outsiderMeetingPoint = await fetch(
      `${base}/api/v1/rides/participations/${participation.id}/meeting-point`,
      { headers: headers(outsider.cookie) },
    );
    assert.equal(outsiderMeetingPoint.status, 403);

    const publicAfterMeetingPoint = await fetch(`${base}/api/public/v1/rides/offers/${offer.id}`);
    assert.equal(publicAfterMeetingPoint.status, 200);
    assert.equal(
      JSON.stringify(await publicAfterMeetingPoint.json()).includes("Gate 3 beside the blue kiosk"),
      false,
    );

    const createRequest = await fetch(`${base}/api/v1/rides/requests`, {
      method: "POST",
      headers: headers(requester.cookie),
      body: JSON.stringify({
        destination: { type: "CUSTOM", customDestinationLabel: "El Menzah Stadium" },
        pickupAreaLabel: "Ariana",
        desiredDepartureAt: futureDate(120),
        passengerCount: 2,
        expiresAt: futureDate(60),
        note: "Can leave from the main roundabout.",
      }),
    });
    assert.equal(createRequest.status, 201);
    const rideRequest = (await createRequest.json()) as { id: string; requesterUserId: string };
    rideRequestId = rideRequest.id;
    assert.equal(rideRequest.requesterUserId, requester.userId);
    assert.equal(
      (await db.rideRequest.findUniqueOrThrow({ where: { id: rideRequest.id } })).requesterUserId,
      requester.userId,
    );

    const publicRequests = await fetch(`${base}/api/public/v1/rides/requests`);
    assert.equal(publicRequests.status, 200);
    const requestItem = (
      (await publicRequests.json()) as { items: Record<string, unknown>[] }
    ).items.find((item) => item.id === rideRequest.id);
    assert.ok(requestItem);
    assert.equal("requesterUserId" in requestItem, false);

    const nonOwnerRequestPatch = await fetch(`${base}/api/v1/rides/requests/${rideRequest.id}`, {
      method: "PATCH",
      headers: headers(passenger.cookie),
      body: JSON.stringify({ pickupAreaLabel: "Not mine" }),
    });
    assert.equal(nonOwnerRequestPatch.status, 403);

    const cancelRequest = await fetch(`${base}/api/v1/rides/requests/${rideRequest.id}/cancel`, {
      method: "POST",
      headers: headers(requester.cookie),
    });
    assert.equal(cancelRequest.status, 200);
    assert.equal(((await cancelRequest.json()) as { status: string }).status, "CANCELLED");

    const publicCancelledRequest = await fetch(
      `${base}/api/public/v1/rides/requests/${rideRequest.id}`,
    );
    assert.equal(publicCancelledRequest.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    if (rideOfferId) {
      await db.rideMeetingPoint.deleteMany({
        where: { participation: { rideOfferId } },
      });
      await db.rideParticipation.deleteMany({ where: { rideOfferId } });
      await db.rideOfferWaypoint.deleteMany({ where: { rideOfferId } });
      await db.rideOffer.deleteMany({ where: { id: rideOfferId } });
    }
    if (rideRequestId) {
      await db.rideRequest.deleteMany({ where: { id: rideRequestId } });
    }
    if (createdUserIds.length > 0) {
      await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.telegramIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }
});
