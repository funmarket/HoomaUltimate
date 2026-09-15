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

async function createCommunity(base: string, cookie: string, name: string) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ name }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

async function createPlayEvent(
  base: string,
  cookie: string,
  communityId: string,
  title: string,
) {
  const response = await fetch(`${base}/api/v1/events`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      communityId,
      type: "PLAY",
      title,
      startsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      entryFeeMinor: 0,
      play: {
        pitchType: "FIVE_A_SIDE",
        skillLevel: "MIXED",
        format: "FIVE_V_FIVE",
      },
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
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
    const community = await createCommunity(base, founderCookie, "Lifecycle Race");
    const event = await createPlayEvent(base, founderCookie, community.id, "Lifecycle race");

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

test("updates serialize with cancellation and completion without editing a closed event", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founderCookie = await register(base, "lifecycle_update_founder");
    const community = await createCommunity(base, founderCookie, "Update Lifecycle Race");

    for (const [terminalAction, terminalStatus] of [
      ["cancel", "CANCELLED"],
      ["complete", "COMPLETED"],
    ] as const) {
      const originalTitle = `Original ${terminalAction}`;
      const updatedTitle = `Updated ${terminalAction}`;
      const event = await createPlayEvent(base, founderCookie, community.id, originalTitle);

      const [updateResponse, lifecycleResponse] = await Promise.all([
        fetch(`${base}/api/v1/events/${event.id}`, {
          method: "PATCH",
          headers: headers(founderCookie),
          body: JSON.stringify({ title: updatedTitle }),
        }),
        fetch(`${base}/api/v1/events/${event.id}/${terminalAction}`, {
          method: "POST",
          headers: headers(founderCookie),
        }),
      ]);

      assert.equal(lifecycleResponse.status, 200);
      assert.ok(updateResponse.status === 200 || updateResponse.status === 409);

      const stored = await db.event.findUniqueOrThrow({
        where: { id: event.id },
        select: { status: true, title: true },
      });
      assert.equal(stored.status, terminalStatus);

      if (updateResponse.status === 200) {
        assert.equal(stored.title, updatedTitle);
      } else {
        assert.equal(stored.title, originalTitle);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await resetDatabase();
  }
});
