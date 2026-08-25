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

test("configured owner is sole full admin and delegates selective Watch/Pitch moderation", async () => {
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
      {
        status: "ready",
      },
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
      body: JSON.stringify({
        capabilities: ["REVIEW_PLACES", "REVIEW_PLACE_OWNERSHIP", "REVIEW_WATCH_APPLICATIONS"],
      }),
    });
    assert.equal(managerGrant.status, 200);

    const managerAccess = await fetch(`${base}/api/v1/admin/access`, {
      headers: headers(manager.cookie),
    });
    assert.equal(managerAccess.status, 200);
    assert.deepEqual(await managerAccess.json(), {
      isPlatformOwner: false,
      managerCapabilities: ["REVIEW_PLACES", "REVIEW_PLACE_OWNERSHIP", "REVIEW_WATCH_APPLICATIONS"],
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
        address: "1 Football Street",
        city: "Tunis",
        houma: "Centre",
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

    const placeDecision = await fetch(`${base}/api/v1/admin/queues/places/${place.id}/decision`, {
      method: "POST",
      headers: headers(manager.cookie),
      body: JSON.stringify({ decision: "APPROVE", note: "Verified venue" }),
    });
    assert.equal(placeDecision.status, 200);

    const claimResponse = await fetch(`${base}/api/v1/places/${place.id}/ownership-claims`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({ evidence: "Registered manager evidence for this venue" }),
    });
    assert.equal(claimResponse.status, 201);
    const claim = (await claimResponse.json()) as { id: string };

    const claimDecision = await fetch(
      `${base}/api/v1/admin/queues/place-ownership/${claim.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE", note: "Ownership confirmed" }),
      },
    );
    assert.equal(claimDecision.status, 200);

    const watchResponse = await fetch(`${base}/api/v1/watch/applications`, {
      method: "POST",
      headers: headers(business.cookie),
      body: JSON.stringify({
        placeId: place.id,
        summary: "Football viewing lounge with match-night screens and reservations",
        contactName: "Venue Manager",
        contactEmail: "venue@example.com",
      }),
    });
    assert.equal(watchResponse.status, 201);
    const watchApplication = (await watchResponse.json()) as { id: string };

    const watchDecision = await fetch(
      `${base}/api/v1/admin/queues/watch/${watchApplication.id}/decision`,
      {
        method: "POST",
        headers: headers(manager.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(watchDecision.status, 200);

    const publicWatch = await fetch(`${base}/api/public/v1/watch`);
    assert.equal(publicWatch.status, 200);
    assert.equal(
      ((await publicWatch.json()) as { id: string }[]).some(
        (item) => item.id === watchApplication.id,
      ),
      true,
    );

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

    const managerPitchQueue = await fetch(`${base}/api/v1/admin/queues/pitch`, {
      headers: headers(manager.cookie),
    });
    assert.equal(managerPitchQueue.status, 403);

    const ownerPitchDecision = await fetch(
      `${base}/api/v1/admin/queues/pitch/${pitchApplication.id}/decision`,
      {
        method: "POST",
        headers: headers(owner.cookie),
        body: JSON.stringify({ decision: "APPROVE" }),
      },
    );
    assert.equal(ownerPitchDecision.status, 200);

    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "WATCH_APPLICATION_APPROVED", entityId: watchApplication.id },
      }),
    );
    assert.ok(
      await db.auditLog.findFirst({
        where: { action: "PITCH_APPLICATION_APPROVED", entityId: pitchApplication.id },
      }),
    );
  } finally {
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
