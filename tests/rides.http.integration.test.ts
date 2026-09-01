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
        context: "GENERAL",
        destination: { type: "CUSTOM", customDestinationLabel: "Stade Olympique de Rades" },
        originAreaLabel: "Lac 2",
        departureAt: futureDate(90),
        totalSeats: 1,
        compensationTerms: {
          type: "CASH",
          amountMinor: 10000,
          currency: "TND",
          basis: "PER_SEAT",
        },
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
      context: string;
      compensationTerms: unknown;
    };
    rideOfferId = offer.id;
    assert.equal(offer.driverUserId, driver.userId);
    assert.equal(offer.context, "GENERAL");
    assert.deepEqual(offer.compensationTerms, {
      type: "CASH",
      amountMinor: 10000,
      currency: "TND",
      basis: "PER_SEAT",
    });
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
    assert.equal(publicOffer.context, "GENERAL");
    assert.deepEqual(publicOffer.compensationTerms, {
      type: "CASH",
      amountMinor: 10000,
      currency: "TND",
      basis: "PER_SEAT",
    });
    assert.equal("driverUserId" in publicOffer, false);
    assert.equal("participations" in publicOffer, false);
    assert.equal("meetingPoint" in publicOffer, false);

    const publicOfferDetail = await fetch(`${base}/api/public/v1/rides/offers/${offer.id}`);
    assert.equal(publicOfferDetail.status, 200);
    assert.equal(
      "driverUserId" in ((await publicOfferDetail.json()) as Record<string, unknown>),
      false,
    );

    const matchdayOfferList = await fetch(`${base}/api/public/v1/rides/offers?context=MATCHDAY`);
    assert.equal(matchdayOfferList.status, 200);
    assert.equal(
      ((await matchdayOfferList.json()) as { items: Record<string, unknown>[] }).items.some(
        (item) => item.id === offer.id,
      ),
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
    assert.equal("passenger" in (participation as Record<string, unknown>), false);

    const driverManageAfterJoin = await fetch(`${base}/api/v1/rides/offers/${offer.id}/manage`, {
      headers: headers(driver.cookie),
    });
    assert.equal(driverManageAfterJoin.status, 200);
    const managedOffer = (await driverManageAfterJoin.json()) as {
      participations: {
        id: string;
        passenger: { displayName: string; username: string; photoUrl: string | null } | null;
      }[];
    };
    assert.deepEqual(managedOffer.participations[0]?.passenger, {
      displayName: `ride_passenger_${suffix}`,
      username: `ride_passenger_${suffix}`,
      photoUrl: null,
    });

    const passengerReadbackBeforeAccept = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/me`,
      { headers: headers(passenger.cookie) },
    );
    assert.equal(passengerReadbackBeforeAccept.status, 200);
    const requestedReadback = (await passengerReadbackBeforeAccept.json()) as {
      id: string;
      status: string;
    };
    assert.equal(requestedReadback.id, participation.id);
    assert.equal(requestedReadback.status, "REQUESTED");

    const outsiderReadback = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/me`,
      { headers: headers(outsider.cookie) },
    );
    assert.equal(outsiderReadback.status, 404);
    assert.equal(
      ((await outsiderReadback.json()) as { error: { code: string } }).error.code,
      "RIDE_PARTICIPATION_NOT_FOUND",
    );

    const accept = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/${participation.id}/accept`,
      { method: "POST", headers: headers(driver.cookie) },
    );
    assert.equal(accept.status, 200);
    assert.equal(((await accept.json()) as { status: string }).status, "ACCEPTED");

    const passengerReadbackAfterAccept = await fetch(
      `${base}/api/v1/rides/offers/${offer.id}/participations/me`,
      { headers: headers(passenger.cookie) },
    );
    assert.equal(passengerReadbackAfterAccept.status, 200);
    const acceptedReadback = (await passengerReadbackAfterAccept.json()) as {
      id: string;
      status: string;
    };
    assert.equal(acceptedReadback.id, participation.id);
    assert.equal(acceptedReadback.status, "ACCEPTED");

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
      `${base}/api/v1/rides/participations/${acceptedReadback.id}/meeting-point`,
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
        context: "MATCHDAY",
        destination: { type: "CUSTOM", customDestinationLabel: "El Menzah Stadium" },
        pickupAreaLabel: "Ariana",
        desiredDepartureAt: futureDate(120),
        passengerCount: 2,
        compensationTerms: { type: "CASH", amountMinor: 8000, currency: "TND" },
        expiresAt: futureDate(60),
        note: "Can leave from the main roundabout.",
      }),
    });
    assert.equal(createRequest.status, 201);
    const rideRequest = (await createRequest.json()) as {
      id: string;
      requesterUserId: string;
      context: string;
      compensationTerms: unknown;
    };
    rideRequestId = rideRequest.id;
    assert.equal(rideRequest.requesterUserId, requester.userId);
    assert.equal(rideRequest.context, "MATCHDAY");
    assert.deepEqual(rideRequest.compensationTerms, {
      type: "CASH",
      amountMinor: 8000,
      currency: "TND",
    });
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
    assert.equal(requestItem.context, "MATCHDAY");
    assert.deepEqual(requestItem.compensationTerms, {
      type: "CASH",
      amountMinor: 8000,
      currency: "TND",
    });
    assert.equal("requesterUserId" in requestItem, false);

    const generalRequests = await fetch(`${base}/api/public/v1/rides/requests?context=GENERAL`);
    assert.equal(generalRequests.status, 200);
    assert.equal(
      ((await generalRequests.json()) as { items: Record<string, unknown>[] }).items.some(
        (item) => item.id === rideRequest.id,
      ),
      false,
    );

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

test("Ride My Rides reconstructs authenticated actor activity without leaking private meeting points", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const createdUserIds: string[] = [];
  const rideOfferIds: string[] = [];
  const rideRequestIds: string[] = [];

  async function createOffer(
    cookie: string,
    label: string,
    context: "MATCHDAY" | "GENERAL",
    compensationTerms: unknown,
  ) {
    const response = await fetch(`${base}/api/v1/rides/offers`, {
      method: "POST",
      headers: headers(cookie),
      body: JSON.stringify({
        context,
        destination: { type: "CUSTOM", customDestinationLabel: label },
        originAreaLabel: `${label} origin`,
        departureAt: futureDate(90 + rideOfferIds.length),
        totalSeats: 3,
        compensationTerms,
        vehicleMake: null,
        vehicleModel: null,
        vehicleColor: null,
        note: null,
        waypoints: [],
      }),
    });
    assert.equal(response.status, 201);
    const payload = (await response.json()) as { id: string };
    rideOfferIds.push(payload.id);
    return payload;
  }

  async function createRequest(
    cookie: string,
    label: string,
    context: "MATCHDAY" | "GENERAL",
    compensationTerms: unknown,
  ) {
    const response = await fetch(`${base}/api/v1/rides/requests`, {
      method: "POST",
      headers: headers(cookie),
      body: JSON.stringify({
        context,
        destination: { type: "CUSTOM", customDestinationLabel: label },
        pickupAreaLabel: `${label} pickup`,
        desiredDepartureAt: futureDate(180 + rideRequestIds.length),
        passengerCount: 1,
        compensationTerms,
        expiresAt: futureDate(60),
        note: null,
      }),
    });
    assert.equal(response.status, 201);
    const payload = (await response.json()) as { id: string };
    rideRequestIds.push(payload.id);
    return payload;
  }

  try {
    const protectedMine = await fetch(`${base}/api/v1/rides/mine`, {
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    });
    assert.equal(protectedMine.status, 401);

    const suffix = `mine_${Date.now().toString(36)}`;
    const driverA = await register(base, `ride_driver_a_${suffix}`);
    const driverB = await register(base, `ride_driver_b_${suffix}`);
    const requesterA = await register(base, `ride_requester_a_${suffix}`);
    const requesterB = await register(base, `ride_requester_b_${suffix}`);
    const passengerA = await register(base, `ride_passenger_a_${suffix}`);
    const passengerB = await register(base, `ride_passenger_b_${suffix}`);
    const passengerC = await register(base, `ride_passenger_c_${suffix}`);
    const passengerD = await register(base, `ride_passenger_d_${suffix}`);
    const outsider = await register(base, `ride_outsider_${suffix}`);
    createdUserIds.push(
      driverA.userId,
      driverB.userId,
      requesterA.userId,
      requesterB.userId,
      passengerA.userId,
      passengerB.userId,
      passengerC.userId,
      passengerD.userId,
      outsider.userId,
    );

    const driverAOffer = await createOffer(driverA.cookie, "Driver A matchday offer", "MATCHDAY", {
      type: "CASH",
      amountMinor: 12000,
      currency: "TND",
      basis: "PER_SEAT",
    });
    const driverASecondOffer = await createOffer(
      driverA.cookie,
      "Driver A general offer",
      "GENERAL",
      {
        type: "FREE",
      },
    );
    const driverBOffer = await createOffer(
      driverB.cookie,
      "Driver B private destination",
      "GENERAL",
      {
        type: "FREE",
      },
    );
    const requesterARequest = await createRequest(
      requesterA.cookie,
      "Requester A matchday",
      "MATCHDAY",
      {
        type: "CASH",
        amountMinor: 8000,
        currency: "TND",
      },
    );
    const requesterBRequest = await createRequest(
      requesterB.cookie,
      "Requester B general",
      "GENERAL",
      {
        type: "FREE",
      },
    );

    async function requestParticipation(cookie: string, offerId: string) {
      const response = await fetch(`${base}/api/v1/rides/offers/${offerId}/participations`, {
        method: "POST",
        headers: headers(cookie),
        body: JSON.stringify({ seatCount: 1 }),
      });
      assert.equal(response.status, 201);
      return (await response.json()) as { id: string };
    }

    const driverAOfferParticipations = await Promise.all([
      requestParticipation(passengerB.cookie, driverAOffer.id),
      requestParticipation(passengerC.cookie, driverAOffer.id),
      requestParticipation(passengerD.cookie, driverAOffer.id),
    ]);

    const participationResponse = await fetch(
      `${base}/api/v1/rides/offers/${driverBOffer.id}/participations`,
      {
        method: "POST",
        headers: headers(passengerA.cookie),
        body: JSON.stringify({ seatCount: 1 }),
      },
    );
    assert.equal(participationResponse.status, 201);
    const participation = (await participationResponse.json()) as { id: string };

    const acceptParticipation = await fetch(
      `${base}/api/v1/rides/offers/${driverBOffer.id}/participations/${participation.id}/accept`,
      { method: "POST", headers: headers(driverB.cookie) },
    );
    assert.equal(acceptParticipation.status, 200);

    const privateMeetingPoint = await fetch(
      `${base}/api/v1/rides/offers/${driverBOffer.id}/participations/${participation.id}/meeting-point`,
      {
        method: "PUT",
        headers: headers(driverB.cookie),
        body: JSON.stringify({ label: "Secret Gate 9", latitude: 36.8065, longitude: 10.1815 }),
      },
    );
    assert.equal(privateMeetingPoint.status, 200);

    const driverMine = await fetch(`${base}/api/v1/rides/mine`, {
      headers: headers(driverA.cookie),
    });
    assert.equal(driverMine.status, 200);
    const driverMinePayload = (await driverMine.json()) as {
      offers: {
        items: Array<{
          id: string;
          context: string;
          compensationTerms: unknown;
          participationCount: number;
        }>;
      };
      requests: { items: Array<{ id: string }> };
      participations: { items: Array<{ id: string }> };
    };
    assert.deepEqual(
      driverMinePayload.offers.items.map((offer) => offer.id).sort(),
      [driverAOffer.id, driverASecondOffer.id].sort(),
    );
    assert.equal(
      driverMinePayload.offers.items.some((offer) => offer.id === driverBOffer.id),
      false,
    );
    assert.equal(driverMinePayload.requests.items.length, 0);
    assert.equal(driverMinePayload.participations.items.length, 0);
    assert.equal(
      driverMinePayload.offers.items.some(
        (offer) =>
          offer.context === "MATCHDAY" &&
          JSON.stringify(offer.compensationTerms) ===
            JSON.stringify({
              type: "CASH",
              amountMinor: 12000,
              currency: "TND",
              basis: "PER_SEAT",
            }),
      ),
      true,
    );

    const driverAOfferSummary = driverMinePayload.offers.items.find(
      (offer) => offer.id === driverAOffer.id,
    );
    assert.ok(driverAOfferSummary);
    assert.equal(driverAOfferSummary.participationCount, driverAOfferParticipations.length);
    assert.equal("participations" in driverAOfferSummary, false);
    assert.equal("passengerUserId" in driverAOfferSummary, false);
    assert.equal("passenger" in driverAOfferSummary, false);

    const driverAManage = await fetch(`${base}/api/v1/rides/offers/${driverAOffer.id}/manage`, {
      headers: headers(driverA.cookie),
    });
    assert.equal(driverAManage.status, 200);
    const driverAManagePayload = (await driverAManage.json()) as {
      participations: Array<{ id: string; passengerUserId: string; passenger?: unknown }>;
    };
    assert.deepEqual(
      driverAManagePayload.participations.map((item) => item.id).sort(),
      driverAOfferParticipations.map((item) => item.id).sort(),
    );
    assert.equal("passengerUserId" in driverAManagePayload.participations[0], true);

    const limitedDriverMine = await fetch(`${base}/api/v1/rides/mine?limit=1`, {
      headers: headers(driverA.cookie),
    });
    assert.equal(limitedDriverMine.status, 200);
    const limitedPayload = (await limitedDriverMine.json()) as {
      offers: { items: unknown[]; nextCursor: string | null };
    };
    assert.equal(limitedPayload.offers.items.length, 1);
    assert.ok(limitedPayload.offers.nextCursor);

    const requesterMine = await fetch(`${base}/api/v1/rides/mine`, {
      headers: headers(requesterA.cookie),
    });
    assert.equal(requesterMine.status, 200);
    const requesterMinePayload = (await requesterMine.json()) as {
      requests: { items: Array<{ id: string; context: string; compensationTerms: unknown }> };
    };
    assert.deepEqual(
      requesterMinePayload.requests.items.map((request) => request.id),
      [requesterARequest.id],
    );
    assert.equal(
      requesterMinePayload.requests.items.some((request) => request.id === requesterBRequest.id),
      false,
    );
    assert.equal(requesterMinePayload.requests.items[0]?.context, "MATCHDAY");
    assert.deepEqual(requesterMinePayload.requests.items[0]?.compensationTerms, {
      type: "CASH",
      amountMinor: 8000,
      currency: "TND",
    });

    const passengerMine = await fetch(`${base}/api/v1/rides/mine`, {
      headers: headers(passengerA.cookie),
    });
    assert.equal(passengerMine.status, 200);
    const passengerMinePayload = (await passengerMine.json()) as {
      participations: {
        items: Array<{ id: string; status: string; offer: { id: string; context: string } }>;
      };
    };
    assert.deepEqual(
      passengerMinePayload.participations.items.map((item) => item.id),
      [participation.id],
    );
    assert.equal(passengerMinePayload.participations.items[0]?.status, "ACCEPTED");
    assert.equal(passengerMinePayload.participations.items[0]?.offer.id, driverBOffer.id);
    assert.equal(passengerMinePayload.participations.items[0]?.offer.context, "GENERAL");
    assert.equal(JSON.stringify(passengerMinePayload).includes("Secret Gate 9"), false);
    assert.equal(JSON.stringify(passengerMinePayload).includes("latitude"), false);
    assert.equal(JSON.stringify(passengerMinePayload).includes("longitude"), false);

    const outsiderMine = await fetch(`${base}/api/v1/rides/mine`, {
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderMine.status, 200);
    assert.deepEqual(await outsiderMine.json(), {
      offers: { items: [], nextCursor: null },
      requests: { items: [], nextCursor: null },
      participations: { items: [], nextCursor: null },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    for (const rideOfferId of rideOfferIds) {
      await db.rideMeetingPoint.deleteMany({
        where: { participation: { rideOfferId } },
      });
      await db.rideParticipation.deleteMany({ where: { rideOfferId } });
      await db.rideOfferWaypoint.deleteMany({ where: { rideOfferId } });
      await db.rideOffer.deleteMany({ where: { id: rideOfferId } });
    }
    for (const rideRequestId of rideRequestIds) {
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
