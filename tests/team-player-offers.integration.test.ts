import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Team player offer integration tests");
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

test("Play recruits through Teams ownership: authorized offer, target response, one canonical row", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);

  try {
    const coach = await register(base, `offer_coach_${suffix}`);
    const assistant = await register(base, `offer_assistant_${suffix}`);
    const target = await register(base, `offer_target_${suffix}`);
    const declinedTarget = await register(base, `offer_decline_${suffix}`);
    const outsider = await register(base, `offer_outsider_${suffix}`);

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(coach.cookie),
      body: JSON.stringify({ name: `Offer HOOMA ${suffix}` }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const teamResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: headers(coach.cookie),
      body: JSON.stringify({ communityId: community.id, name: `Offer FC ${suffix}` }),
    });
    assert.equal(teamResponse.status, 201);
    const team = (await teamResponse.json()) as { id: string };

    const assistantResponse = await fetch(`${base}/api/v1/teams/${team.id}/assistants`, {
      method: "POST",
      headers: headers(coach.cookie),
      body: JSON.stringify({ userId: assistant.userId, capabilities: ["MANAGE_ROSTER"] }),
    });
    assert.equal(assistantResponse.status, 201);

    const targetListingResponse = await fetch(`${base}/api/v1/play/player-listing`, {
      method: "PUT",
      headers: headers(target.cookie),
      body: JSON.stringify({ lookingFor: "TEAM" }),
    });
    assert.equal(targetListingResponse.status, 200);
    const targetListing = (await targetListingResponse.json()) as { id: string };

    const declineListingResponse = await fetch(`${base}/api/v1/play/player-listing`, {
      method: "PUT",
      headers: headers(declinedTarget.cookie),
      body: JSON.stringify({ lookingFor: "TEAM" }),
    });
    assert.equal(declineListingResponse.status, 200);
    const declineListing = (await declineListingResponse.json()) as { id: string };

    const outsiderOffer = await fetch(
      `${base}/api/v1/play/player-listings/${targetListing.id}/team-offer`,
      {
        method: "POST",
        headers: headers(outsider.cookie),
        body: JSON.stringify({ teamId: team.id }),
      },
    );
    assert.equal(outsiderOffer.status, 403);

    const sendOffer = () =>
      fetch(`${base}/api/v1/play/player-listings/${targetListing.id}/team-offer`, {
        method: "POST",
        headers: headers(assistant.cookie),
        body: JSON.stringify({
          teamId: team.id,
          message: "Come train with us this week.",
        }),
      });

    const firstOfferResponse = await sendOffer();
    assert.equal(firstOfferResponse.status, 201);
    const firstOffer = (await firstOfferResponse.json()) as { id: string; status: string };
    assert.equal(firstOffer.status, "PENDING");

    const secondOfferResponse = await sendOffer();
    assert.equal(secondOfferResponse.status, 201);
    const secondOffer = (await secondOfferResponse.json()) as { id: string };
    assert.equal(secondOffer.id, firstOffer.id);
    assert.equal(
      await db.teamPlayerOffer.count({
        where: { teamId: team.id, targetUserId: target.userId },
      }),
      1,
    );

    const incomingResponse = await fetch(`${base}/api/v1/teams/offers/incoming`, {
      headers: headers(target.cookie),
    });
    assert.equal(incomingResponse.status, 200);
    const incoming = (await incomingResponse.json()) as {
      id: string;
      team: { name: string };
    }[];
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0]?.id, firstOffer.id);

    const outsiderAccept = await fetch(`${base}/api/v1/teams/offers/${firstOffer.id}/accept`, {
      method: "POST",
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderAccept.status, 404);

    const acceptResponse = await fetch(`${base}/api/v1/teams/offers/${firstOffer.id}/accept`, {
      method: "POST",
      headers: headers(target.cookie),
    });
    assert.equal(acceptResponse.status, 200);
    assert.equal(
      await db.teamPlayer.count({
        where: { teamId: team.id, userId: target.userId, active: true, leftAt: null },
      }),
      1,
    );
    assert.equal(
      (await db.teamPlayerOffer.findUniqueOrThrow({ where: { id: firstOffer.id } })).status,
      "ACCEPTED",
    );

    const declineOfferResponse = await fetch(
      `${base}/api/v1/play/player-listings/${declineListing.id}/team-offer`,
      {
        method: "POST",
        headers: headers(coach.cookie),
        body: JSON.stringify({ teamId: team.id }),
      },
    );
    assert.equal(declineOfferResponse.status, 201);
    const declineOffer = (await declineOfferResponse.json()) as { id: string };

    const declineResponse = await fetch(`${base}/api/v1/teams/offers/${declineOffer.id}/decline`, {
      method: "POST",
      headers: headers(declinedTarget.cookie),
    });
    assert.equal(declineResponse.status, 200);
    assert.equal(
      await db.teamPlayer.count({
        where: { teamId: team.id, userId: declinedTarget.userId, active: true, leftAt: null },
      }),
      0,
    );
    assert.equal(
      (await db.teamPlayerOffer.findUniqueOrThrow({ where: { id: declineOffer.id } })).status,
      "DECLINED",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
