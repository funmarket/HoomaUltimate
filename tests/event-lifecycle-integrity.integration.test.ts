import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Event lifecycle integration tests");
}

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

async function resetDatabase() {
  await db.eventChatMessage.deleteMany();
  await db.eventChatRoom.deleteMany();
  await db.eventCheckIn.deleteMany();
  await db.formationSlot.deleteMany();
  await db.formation.deleteMany();
  await db.eventPlayerInvite.deleteMany();
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
  await db.watchEventDetails.deleteMany();
  await db.event.deleteMany();
  await db.place.deleteMany();
  await db.teamGame.deleteMany();
  await db.teamChallengeMessage.deleteMany();
  await db.teamChallenge.deleteMany();
  await db.teamLineupSlot.deleteMany();
  await db.teamLineup.deleteMany();
  await db.teamCapabilityGrant.deleteMany();
  await db.teamResponsibilityAssignment.deleteMany();
  await db.teamPlayer.deleteMany();
  await db.team.deleteMany();
  await db.communityMembership.deleteMany();
  await db.community.deleteMany();
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

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
  return cookie;
}

function headers(cookie: string) {
  return {
    cookie,
    origin: config.WEB_ORIGIN,
    "content-type": "application/json",
  };
}

test("cancel and complete serialize so exactly one terminal transition wins", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founderCookie = await register(base, "lifecycle_race_founder");
    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founderCookie),
      body: JSON.stringify({ name: "Lifecycle Race" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const eventResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(founderCookie),
      body: JSON.stringify({
        communityId: community.id,
        type: "PLAY",
        title: "Lifecycle race",
        startsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        entryFeeMinor: 0,
        play: {
          pitchType: "FIVE_A_SIDE",
          skillLevel: "MIXED",
          format: "FIVE_V_FIVE",
        },
      }),
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { id: string };

    const [cancelResponse, completeResponse] = await Promise.all([
      fetch(`${base}/api/v1/events/${event.id}/cancel`, {
        method: "POST",
        headers: headers(founderCookie),
      }),
      fetch(`${base}/api/v1/events/${event.id}/complete`, {
        method: "POST",
        headers: headers(founderCookie),
      }),
    ]);

    assert.deepEqual(
      [cancelResponse.status, completeResponse.status].sort((a, b) => a - b),
      [200, 409],
    );

    const stored = await db.event.findUniqueOrThrow({
      where: { id: event.id },
      select: { status: true },
    });
    assert.ok(stored.status === "CANCELLED" || stored.status === "COMPLETED");

    if (stored.status === "CANCELLED") {
      assert.equal(cancelResponse.status, 200);
      assert.equal(completeResponse.status, 409);
    } else {
      assert.equal(cancelResponse.status, 409);
      assert.equal(completeResponse.status, 200);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await resetDatabase();
  }
});
