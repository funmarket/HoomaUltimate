import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for discovery privacy integration tests");

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
  await db.eventPlayerInvite.deleteMany();
  await db.eventChatMessage.deleteMany();
  await db.eventChatRoom.deleteMany();
  await db.eventCheckIn.deleteMany();
  await db.formationSlot.deleteMany();
  await db.formation.deleteMany();
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
  await db.event.deleteMany();
  await db.playPlayerListing.deleteMany();
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
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

async function createPlayEvent(
  base: string,
  cookie: string,
  communityId: string,
  title: string,
  visibility: "OPEN" | "PRIVATE",
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
        visibility,
      },
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

async function openMatchIds(base: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/play/open-matches?limit=100`, {
    headers: { cookie },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { items: { id: string }[] };
  return body.items.map((item) => item.id);
}

test("Play discovery preserves Event privacy and Event-free listings", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founderCookie = await register(base, "discovery_privacy_founder");
    const outsiderCookie = await register(base, "discovery_privacy_outsider");

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founderCookie),
      body: JSON.stringify({ name: "Discovery Privacy" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const openEvent = await createPlayEvent(
      base,
      founderCookie,
      community.id,
      "Visible open game",
      "OPEN",
    );
    const privateEvent = await createPlayEvent(
      base,
      founderCookie,
      community.id,
      "Hidden private game",
      "PRIVATE",
    );
    const cancelledEvent = await createPlayEvent(
      base,
      founderCookie,
      community.id,
      "Cancelled game",
      "OPEN",
    );
    const completedEvent = await createPlayEvent(
      base,
      founderCookie,
      community.id,
      "Completed game",
      "OPEN",
    );

    const cancelResponse = await fetch(`${base}/api/v1/events/${cancelledEvent.id}/cancel`, {
      method: "POST",
      headers: headers(founderCookie),
    });
    assert.equal(cancelResponse.status, 200);

    const completeResponse = await fetch(`${base}/api/v1/events/${completedEvent.id}/complete`, {
      method: "POST",
      headers: headers(founderCookie),
    });
    assert.equal(completeResponse.status, 200);

    const visibleIds = await openMatchIds(base, outsiderCookie);
    assert.ok(visibleIds.includes(openEvent.id));
    assert.equal(visibleIds.includes(privateEvent.id), false);
    assert.equal(visibleIds.includes(cancelledEvent.id), false);
    assert.equal(visibleIds.includes(completedEvent.id), false);

    const privateDetail = await fetch(`${base}/api/v1/play/matches/${privateEvent.id}`, {
      headers: { cookie: outsiderCookie },
    });
    assert.equal(privateDetail.status, 404);

    const missingDetail = await fetch(`${base}/api/v1/play/matches/event-does-not-exist`, {
      headers: { cookie: outsiderCookie },
    });
    assert.equal(missingDetail.status, 404);

    const listingResponse = await fetch(`${base}/api/v1/play/player-listing`, {
      method: "PUT",
      headers: headers(outsiderCookie),
      body: JSON.stringify({ lookingFor: "GAME" }),
    });
    assert.equal(listingResponse.status, 200);
    const listing = (await listingResponse.json()) as { id: string };

    const publicListings = await fetch(`${base}/api/public/v1/play/player-listings`);
    assert.equal(publicListings.status, 200);
    const listingPage = (await publicListings.json()) as {
      items: Array<Record<string, unknown> & { id: string }>;
    };
    const discoveredListing = listingPage.items.find((item) => item.id === listing.id);
    assert.ok(discoveredListing);
    assert.equal("eventId" in discoveredListing, false);
    assert.deepEqual(Object.keys(discoveredListing).sort(), [
      "id",
      "lookingFor",
      "presentation",
      "updatedAt",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await resetDatabase();
  }
});
