import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Event player invitation integration tests");
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

test("Play game invitations stay Events-owned and accept through canonical RSVP policy", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);

  try {
    const founder = await register(base, `invite_founder_${suffix}`);
    const target = await register(base, `invite_target_${suffix}`);
    const declinedTarget = await register(base, `invite_decline_${suffix}`);
    const fullTarget = await register(base, `invite_full_${suffix}`);
    const cancelTarget = await register(base, `invite_cancel_${suffix}`);
    const occupant = await register(base, `invite_occupant_${suffix}`);
    const outsider = await register(base, `invite_outsider_${suffix}`);

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ name: `Invite HOOMA ${suffix}` }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    async function createEvent(title: string, capacity: number | null, waitlistEnabled: boolean) {
      const startsAt = new Date(Date.now() + 60 * 60_000);
      const response = await fetch(`${base}/api/v1/events`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({
          communityId: community.id,
          type: "PLAY",
          title,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 2 * 60 * 60_000).toISOString(),
          capacity,
          waitlistEnabled,
          entryFeeMinor: 0,
          play: { pitchType: "FIVE_A_SIDE", skillLevel: "MIXED", format: "FIVE_V_FIVE" },
        }),
      });
      assert.equal(response.status, 201);
      return (await response.json()) as { id: string };
    }

    async function publishGameListing(user: { cookie: string }) {
      const response = await fetch(`${base}/api/v1/play/player-listing`, {
        method: "PUT",
        headers: headers(user.cookie),
        body: JSON.stringify({ lookingFor: "GAME" }),
      });
      assert.equal(response.status, 200);
      return (await response.json()) as { id: string };
    }

    async function sendInvite(
      actor: { cookie: string },
      listingId: string,
      eventId: string,
    ) {
      return fetch(`${base}/api/v1/play/player-listings/${listingId}/event-invite`, {
        method: "POST",
        headers: headers(actor.cookie),
        body: JSON.stringify({ eventId }),
      });
    }

    const event = await createEvent(`Invite Match ${suffix}`, 5, true);
    const targetListing = await publishGameListing(target);
    const declineListing = await publishGameListing(declinedTarget);
    const fullListing = await publishGameListing(fullTarget);
    const cancelListing = await publishGameListing(cancelTarget);

    const outsiderInvite = await sendInvite(outsider, targetListing.id, event.id);
    assert.equal(outsiderInvite.status, 403);

    const firstInviteResponse = await sendInvite(founder, targetListing.id, event.id);
    assert.equal(firstInviteResponse.status, 201);
    const firstInvite = (await firstInviteResponse.json()) as { id: string; status: string };
    assert.equal(firstInvite.status, "PENDING");

    const duplicateInviteResponse = await sendInvite(founder, targetListing.id, event.id);
    assert.equal(duplicateInviteResponse.status, 201);
    const duplicateInvite = (await duplicateInviteResponse.json()) as { id: string };
    assert.equal(duplicateInvite.id, firstInvite.id);
    assert.equal(
      await db.eventPlayerInvite.count({
        where: { eventId: event.id, targetUserId: target.userId },
      }),
      1,
    );

    const incomingResponse = await fetch(`${base}/api/v1/events/invitations/incoming`, {
      headers: headers(target.cookie),
    });
    assert.equal(incomingResponse.status, 200);
    const incoming = (await incomingResponse.json()) as { id: string }[];
    assert.ok(incoming.some((invite) => invite.id === firstInvite.id));

    const outsiderAccept = await fetch(
      `${base}/api/v1/events/invitations/${firstInvite.id}/accept`,
      { method: "POST", headers: headers(outsider.cookie) },
    );
    assert.equal(outsiderAccept.status, 404);

    const acceptResponse = await fetch(
      `${base}/api/v1/events/invitations/${firstInvite.id}/accept`,
      { method: "POST", headers: headers(target.cookie) },
    );
    assert.equal(acceptResponse.status, 200);
    const acceptedPayload = (await acceptResponse.json()) as { rsvp: { status: string } };
    assert.equal(acceptedPayload.rsvp.status, "CONFIRMED");
    assert.equal(
      (await db.eventPlayerInvite.findUniqueOrThrow({ where: { id: firstInvite.id } })).status,
      "ACCEPTED",
    );
    assert.equal(
      (
        await db.eventRsvp.findUniqueOrThrow({
          where: { eventId_userId: { eventId: event.id, userId: target.userId } },
        })
      ).status,
      "CONFIRMED",
    );

    const declineInviteResponse = await sendInvite(founder, declineListing.id, event.id);
    assert.equal(declineInviteResponse.status, 201);
    const declineInvite = (await declineInviteResponse.json()) as { id: string };
    const declineResponse = await fetch(
      `${base}/api/v1/events/invitations/${declineInvite.id}/decline`,
      { method: "POST", headers: headers(declinedTarget.cookie) },
    );
    assert.equal(declineResponse.status, 200);
    assert.equal(
      (await db.eventPlayerInvite.findUniqueOrThrow({ where: { id: declineInvite.id } })).status,
      "DECLINED",
    );
    assert.equal(
      await db.eventRsvp.count({
        where: { eventId: event.id, userId: declinedTarget.userId },
      }),
      0,
    );

    const fullEvent = await createEvent(`Full Match ${suffix}`, 1, false);
    const occupyResponse = await fetch(`${base}/api/v1/events/${fullEvent.id}/join`, {
      method: "POST",
      headers: headers(occupant.cookie),
    });
    assert.equal(occupyResponse.status, 200);
    const fullInviteResponse = await sendInvite(founder, fullListing.id, fullEvent.id);
    assert.equal(fullInviteResponse.status, 201);
    const fullInvite = (await fullInviteResponse.json()) as { id: string };
    const fullAccept = await fetch(
      `${base}/api/v1/events/invitations/${fullInvite.id}/accept`,
      { method: "POST", headers: headers(fullTarget.cookie) },
    );
    assert.equal(fullAccept.status, 409);
    assert.equal(
      (await db.eventPlayerInvite.findUniqueOrThrow({ where: { id: fullInvite.id } })).status,
      "PENDING",
    );
    assert.equal(
      await db.eventRsvp.count({
        where: { eventId: fullEvent.id, userId: fullTarget.userId },
      }),
      0,
    );

    const cancelEvent = await createEvent(`Cancelled Match ${suffix}`, 5, true);
    const pendingCancelResponse = await sendInvite(founder, cancelListing.id, cancelEvent.id);
    assert.equal(pendingCancelResponse.status, 201);
    const pendingCancel = (await pendingCancelResponse.json()) as { id: string };
    const cancelEventResponse = await fetch(`${base}/api/v1/events/${cancelEvent.id}/cancel`, {
      method: "POST",
      headers: headers(founder.cookie),
    });
    assert.equal(cancelEventResponse.status, 200);
    assert.equal(
      (await db.eventPlayerInvite.findUniqueOrThrow({ where: { id: pendingCancel.id } })).status,
      "CANCELLED",
    );

    const removeListing = await fetch(`${base}/api/v1/play/player-listing`, {
      method: "DELETE",
      headers: headers(cancelTarget.cookie),
    });
    assert.equal(removeListing.status, 200);
    const staleSend = await sendInvite(founder, cancelListing.id, event.id);
    assert.equal(staleSend.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
