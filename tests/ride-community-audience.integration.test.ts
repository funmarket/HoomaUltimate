import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for Ride Community audience integration tests");

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

async function createCommunity(base: string, founderCookie: string, name: string) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(founderCookie),
    body: JSON.stringify({ name }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string; name: string; slug: string };
}

async function joinCommunity(base: string, cookie: string, communityId: string) {
  const response = await fetch(`${base}/api/v1/communities/${communityId}/join`, {
    method: "POST",
    headers: headers(cookie),
  });
  assert.equal(response.status, 201);
}

async function createRideRequest(base: string, cookie: string, label: string, audience: unknown) {
  const response = await fetch(`${base}/api/v1/rides/requests`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      context: "MATCHDAY",
      destination: { type: "CUSTOM", customDestinationLabel: label },
      pickupAreaLabel: `${label} pickup area`,
      desiredDepartureAt: futureDate(90),
      passengerCount: 2,
      compensationTerms: { type: "FREE" },
      expiresAt: futureDate(45),
      note: "Meet near the public gate.",
      audience,
    }),
  });
  return response;
}

async function communityRideIds(base: string, cookie: string, communityId: string) {
  const response = await fetch(`${base}/api/v1/rides/communities/${communityId}/requests`, {
    headers: headers(cookie),
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { items: Array<{ id: string; href: string }> };
  return payload.items.map((item) => ({ id: item.id, href: item.href }));
}

async function publicRideIds(base: string, path = "/api/public/v1/rides/requests") {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { items: Array<{ id: string }> };
  return payload.items.map((item) => item.id);
}

test("Community RideRequest audience targets one HOOMA without global public leakage", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `ride_one_${Date.now().toString(36)}`;
  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];
  const createdRideRequestIds: string[] = [];

  try {
    const founder = await register(base, `${suffix}_founder`);
    const requester = await register(base, `${suffix}_requester`);
    const viewer = await register(base, `${suffix}_viewer`);
    const outsider = await register(base, `${suffix}_outsider`);
    createdUserIds.push(founder.userId, requester.userId, viewer.userId, outsider.userId);

    const communityA = await createCommunity(base, founder.cookie, `${suffix} A`);
    const communityB = await createCommunity(base, founder.cookie, `${suffix} B`);
    createdCommunityIds.push(communityA.id, communityB.id);
    await joinCommunity(base, requester.cookie, communityA.id);
    await joinCommunity(base, requester.cookie, communityB.id);
    await joinCommunity(base, viewer.cookie, communityA.id);
    await joinCommunity(base, viewer.cookie, communityB.id);

    const response = await createRideRequest(base, requester.cookie, `${suffix} request`, {
      scope: "COMMUNITY",
      selection: "ONE",
      communityId: communityA.id,
    });
    assert.equal(response.status, 201);
    const rideRequest = (await response.json()) as {
      id: string;
      requesterUserId: string;
      audience: { scope: string; communities: Array<{ id: string; name: string }> };
    };
    createdRideRequestIds.push(rideRequest.id);
    assert.equal(rideRequest.requesterUserId, requester.userId);
    assert.deepEqual(
      rideRequest.audience.communities.map((community) => community.id),
      [communityA.id],
    );

    assert.equal(await db.rideRequest.count({ where: { id: rideRequest.id } }), 1);
    assert.deepEqual(
      (
        await db.rideRequestCommunityAudience.findMany({
          where: { rideRequestId: rideRequest.id },
          select: { communityId: true },
        })
      ).map((row) => row.communityId),
      [communityA.id],
    );
    assert.equal((await publicRideIds(base)).includes(rideRequest.id), false);
    assert.equal(
      (await publicRideIds(base, "/api/public/v1/rides/requests?context=MATCHDAY")).includes(
        rideRequest.id,
      ),
      false,
    );

    const publicDetail = await fetch(`${base}/api/public/v1/rides/requests/${rideRequest.id}`);
    assert.equal(publicDetail.status, 404);
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityA.id))[0]?.id,
      rideRequest.id,
    );
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityA.id))[0]?.href,
      "/rides?context=MATCHDAY",
    );
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityB.id)).some(
        (item) => item.id === rideRequest.id,
      ),
      false,
    );
    const outsiderFeed = await fetch(`${base}/api/v1/rides/communities/${communityA.id}/requests`, {
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderFeed.status, 403);

    const mine = await fetch(`${base}/api/v1/rides/mine`, { headers: headers(requester.cookie) });
    assert.equal(mine.status, 200);
    assert.equal(
      ((await mine.json()) as { requests: { items: Array<{ id: string }> } }).requests.items.some(
        (item) => item.id === rideRequest.id,
      ),
      true,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    await db.rideRequestCommunityAudience.deleteMany({
      where: { rideRequestId: { in: createdRideRequestIds } },
    });
    await db.rideRequest.deleteMany({ where: { id: { in: createdRideRequestIds } } });
    await db.communityMembership.deleteMany({
      where: { communityId: { in: createdCommunityIds } },
    });
    await db.community.deleteMany({ where: { id: { in: createdCommunityIds } } });
    await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.telegramIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

test("ALL_CURRENT resolves exact current HOOMAs and lifecycle removes the same request", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `ride_all_${Date.now().toString(36)}`;
  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];
  const createdRideRequestIds: string[] = [];

  try {
    const founder = await register(base, `${suffix}_founder`);
    const requester = await register(base, `${suffix}_requester`);
    const viewer = await register(base, `${suffix}_viewer`);
    createdUserIds.push(founder.userId, requester.userId, viewer.userId);

    const communityA = await createCommunity(base, founder.cookie, `${suffix} A`);
    const communityB = await createCommunity(base, founder.cookie, `${suffix} B`);
    const communityC = await createCommunity(base, founder.cookie, `${suffix} C`);
    const communityD = await createCommunity(base, founder.cookie, `${suffix} D`);
    createdCommunityIds.push(communityA.id, communityB.id, communityC.id, communityD.id);
    for (const community of [communityA, communityB, communityC]) {
      await joinCommunity(base, requester.cookie, community.id);
    }
    for (const community of [communityA, communityB, communityC, communityD]) {
      await joinCommunity(base, viewer.cookie, community.id);
    }

    const response = await createRideRequest(base, requester.cookie, `${suffix} request`, {
      scope: "COMMUNITY",
      selection: "ALL_CURRENT",
    });
    assert.equal(response.status, 201);
    const rideRequest = (await response.json()) as {
      id: string;
      audience: { scope: string; communities: Array<{ id: string }> };
    };
    createdRideRequestIds.push(rideRequest.id);
    assert.equal(rideRequest.audience.scope, "COMMUNITY");
    assert.deepEqual(
      rideRequest.audience.communities.map((community) => community.id).sort(),
      [communityA.id, communityB.id, communityC.id].sort(),
    );
    assert.deepEqual(
      (
        await db.rideRequestCommunityAudience.findMany({
          where: { rideRequestId: rideRequest.id },
          select: { communityId: true },
        })
      )
        .map((row) => row.communityId)
        .sort(),
      [communityA.id, communityB.id, communityC.id].sort(),
    );
    assert.equal((await publicRideIds(base)).includes(rideRequest.id), false);

    for (const community of [communityA, communityB, communityC]) {
      assert.equal(
        (await communityRideIds(base, viewer.cookie, community.id))[0]?.id,
        rideRequest.id,
      );
    }
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityD.id)).some(
        (item) => item.id === rideRequest.id,
      ),
      false,
    );

    await joinCommunity(base, requester.cookie, communityD.id);
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityD.id)).some(
        (item) => item.id === rideRequest.id,
      ),
      false,
    );

    const leaveB = await fetch(`${base}/api/v1/communities/${communityB.id}/membership`, {
      method: "DELETE",
      headers: headers(requester.cookie),
    });
    assert.equal(leaveB.status, 200);
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityA.id))[0]?.id,
      rideRequest.id,
    );
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityB.id)).some(
        (item) => item.id === rideRequest.id,
      ),
      false,
    );
    assert.equal(
      (await communityRideIds(base, viewer.cookie, communityC.id))[0]?.id,
      rideRequest.id,
    );

    const cancel = await fetch(`${base}/api/v1/rides/requests/${rideRequest.id}/cancel`, {
      method: "POST",
      headers: headers(requester.cookie),
    });
    assert.equal(cancel.status, 200);
    for (const community of [communityA, communityC]) {
      assert.equal(
        (await communityRideIds(base, viewer.cookie, community.id)).some(
          (item) => item.id === rideRequest.id,
        ),
        false,
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    await db.rideRequestCommunityAudience.deleteMany({
      where: { rideRequestId: { in: createdRideRequestIds } },
    });
    await db.rideRequest.deleteMany({ where: { id: { in: createdRideRequestIds } } });
    await db.communityMembership.deleteMany({
      where: { communityId: { in: createdCommunityIds } },
    });
    await db.community.deleteMany({ where: { id: { in: createdCommunityIds } } });
    await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.telegramIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});
