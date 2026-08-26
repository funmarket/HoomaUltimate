import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for platform owner integration tests");

const suffix = Date.now().toString(36);
const ownerTelegramId = BigInt(`9${Date.now()}${Math.floor(Math.random() * 1000)}`);
const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
  PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: ownerTelegramId.toString(),
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

test("App Admin approves a submitted Place once, then its owner publishes Watch events directly", async () => {
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const owner = await register(base, `owner_${suffix}`);
    const manager = await register(base, `manager_${suffix}`);
    const business = await register(base, `business_${suffix}`);

    await db.telegramIdentity.create({
      data: { userId: owner.userId, telegramUserId: ownerTelegramId },
    });
    await db.platformRoleAssignment.create({
      data: { userId: manager.userId, role: "PLATFORM_ADMIN", grantedBy: "rogue-test" },
    });

    assert.deepEqual(
      await container.platformAdminService.bootstrapConfiguredOwner(ownerTelegramId.toString()),
      { status: "ready" },
    );
    assert.equal(
      await db.platformRoleAssignment.count({ where: { role: "PLATFORM_ADMIN", revokedAt: null } }),
      1,
    );
    assert.equal(
      await db.platformRoleAssignment.count({
        where: { userId: owner.userId, role: "PLATFORM_ADMIN", revokedAt: null },
      }),
      1,
    );
    assert.equal(
      await db.platformRoleAssignment.count({
        where: { userId: manager.userId, role: "PLATFORM_ADMIN", revokedAt: null },
      }),
      0,
    );

    const managerGrant = await fetch(`${base}/api/v1/admin/managers/manager_${suffix}`, {
      method: "PUT",
      headers: headers(owner.cookie),
      body: JSON.stringify({ capabilities: ["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"] }),
    });
    assert.equal(managerGrant.status, 200);

    const managerAccess = await fetch(`${base}/api/v1/admin/access`, {
      headers: headers(manager.cookie),
    });
    assert.equal(managerAccess.status, 200);
    assert.deepEqual(await managerAccess.json(), {
      isPlatformOwner: false,
      managerCapabilities: ["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"],
    });

    const forbiddenDelegation = await fetch(`${base}/api/v1/admin/managers/business_${suffix}`, {
      method: "PUT",
      headers: headers(manager.cookie),
      body: JSON.stringify({ capabilities: ["REVIEW_PITCH_APPLICATIONS"] }),
    });
    assert.equal(forbiddenDelegation.status, 403);

    const placeResponse = await fetch(`${base}/api/v1/places`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        name: `Owner Venue ${suffix}`,
        category: "Sports café",
        description: "Match-night venue with large screens",
        imageUrl: "https://images.example.com/venue/photo?id=123&size=large",
        address: "1 Football Street",
        city: "Tunis",
        houma: "Centre",
        phone: "+21671000000",
        email: "venue@example.com",
        websiteUrl: "https://venue.example.com",
      }),
    });
    assert.equal(placeResponse.status, 201);
    const place = (await placeResponse.json()) as { id: string; status: string };
    assert.equal(place.status, "PENDING");

    const beforeApproval = await fetch(`${base}/api/public/v1/places`);
    assert.equal(beforeApproval.status, 200);
    assert.equal(
      ((await beforeApproval.json()) as { id: string }[]).some((item) => item.id === place.id),
      false,
    );

    const managerPlaceDecision = await fetch(
      `${base}/api/v1/admin/queues/places/${place.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(managerPlaceDecision.status, 403);

    const placeDecision = await fetch(`${base}/api/v1/admin/queues/places/${place.id}/decision`, {
      method: "POST",
      headers: headers(owner.cookie),
      body: JSON.stringify({ decision: "APPROVE", note: "Approved by App Admin" }),
    });
    assert.equal(placeDecision.status, 200);

    assert.ok(
      await db.placeOwnership.findFirst({
        where: { placeId: place.id, userId: business.userId, revokedAt: null },
      }),
    );

    const publicPlace = await fetch(`${base}/api/public/v1/places/${place.id}`);
    assert.equal(publicPlace.status, 200);
    const approvedPlace = (await publicPlace.json()) as {
      id: string;
      imageUrl: string | null;
      category: string | null;
    };
    assert.equal(approvedPlace.id, place.id);
    assert.equal(
      approvedPlace.imageUrl,
      "https://images.example.com/venue/photo?id=123&size=large",
    );
    assert.equal(approvedPlace.category, "Sports café");

    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const watchResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        communityId: null,
        placeId: place.id,
        type: "WATCH",
        title: `Derby night ${suffix}`,
        startsAt,
        timezone: "Africa/Tunis",
        waitlistEnabled: true,
        entryFeeMinor: 0,
        currency: "TND",
        play: null,
      }),
    });
    assert.equal(watchResponse.status, 201);
    const watchEvent = (await watchResponse.json()) as {
      id: string;
      placeId: string;
      venueAuthority: string;
    };
    assert.equal(watchEvent.placeId, place.id);
    assert.equal(watchEvent.venueAuthority, "OFFICIAL_VENUE");

    const publicWatch = await fetch(`${base}/api/public/v1/events?type=WATCH&limit=50`);
    assert.equal(publicWatch.status, 200);
    const watchPage = (await publicWatch.json()) as {
      items: { id: string; placeId: string; venueAuthority: string }[];
    };
    const publishedWatch = watchPage.items.find((item) => item.id === watchEvent.id);
    assert.ok(publishedWatch);
    assert.equal(publishedWatch.placeId, place.id);
    assert.equal(publishedWatch.venueAuthority, "OFFICIAL_VENUE");

    const removedWatchApplication = await fetch(`${base}/api/v1/watch/applications`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        placeId: place.id,
        summary: "obsolete Watch capability application",
        contactName: "Venue Manager",
      }),
    });
    assert.equal(removedWatchApplication.status, 404);

    const pitchResponse = await fetch(`${base}/api/v1/pitch/applications`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        placeId: place.id,
        summary: "Bookable football pitch with changing rooms and floodlights",
        contactName: "Venue Manager",
      }),
    });
    assert.equal(pitchResponse.status, 201);
    const pitchApplication = (await pitchResponse.json()) as { id: string };

    const managerPitchDecision = await fetch(
      `${base}/api/v1/admin/queues/pitch/${pitchApplication.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(managerPitchDecision.status, 200);

    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "PLACE_APPROVED", entityId: place.id },
      }),
    );
    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "PITCH_APPLICATION_APPROVED", entityId: pitchApplication.id },
      }),
    );
  } finally {
    await db.eventChatMessage.deleteMany();
    await db.eventChatRoom.deleteMany();
    await db.eventRsvp.deleteMany();
    await db.event.deleteMany();
    await db.placeCapabilityApplication.deleteMany();
    await db.placeOwnership.deleteMany();
    await db.placeOwnershipClaim.deleteMany();
    await db.place.deleteMany();
    await db.appManagerGrant.deleteMany();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
