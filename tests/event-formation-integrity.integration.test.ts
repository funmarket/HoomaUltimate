import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Formation integrity integration tests");
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
  const credential = await db.webCredential.findUniqueOrThrow({
    where: { loginUsername: username },
  });
  return { cookie, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function formationSlots(playerA: string, playerB: string) {
  return [
    ...Array.from({ length: 5 }, (_, index) => ({
      userId: index === 0 ? playerA : null,
      team: "A",
      position: index === 0 ? "GK" : "ANY",
      label: `A${index + 1}`,
      x: 15 + index * 15,
      y: 80 - index * 12,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      userId: index === 0 ? playerB : null,
      team: "B",
      position: index === 0 ? "GK" : "ANY",
      label: `B${index + 1}`,
      x: 15 + index * 15,
      y: 20 + index * 12,
    })),
  ];
}

async function errorCode(response: Response) {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

test("Formation preserves Event-owned integrity", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "formation_founder");
    const coach = await register(base, "formation_coach");
    const playerA = await register(base, "formation_player_a");
    const playerB = await register(base, "formation_player_b");
    const outsider = await register(base, "formation_outsider");

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ name: "Formation Integrity" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    await db.communityMembership.create({
      data: { communityId: community.id, userId: coach.userId, role: "COACH" },
    });

    const eventResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        communityId: community.id,
        type: "PLAY",
        title: "Private Five",
        startsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        entryFeeMinor: 0,
        play: {
          pitchType: "FIVE_A_SIDE",
          skillLevel: "MIXED",
          format: "FIVE_V_FIVE",
          visibility: "PRIVATE",
        },
      }),
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { id: string };

    await db.eventRsvp.createMany({
      data: [
        { eventId: event.id, userId: playerA.userId, status: "CONFIRMED" },
        { eventId: event.id, userId: playerB.userId, status: "CONFIRMED" },
      ],
    });

    const slots = formationSlots(playerA.userId, playerB.userId);
    const draftPayload = {
      name: "Draft five",
      format: "FIVE_V_FIVE",
      published: false,
      slots,
    };

    const outsiderCreate = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(outsider.cookie),
      body: JSON.stringify(draftPayload),
    });
    assert.equal(outsiderCreate.status, 403);
    assert.equal(await errorCode(outsiderCreate), "EVENT_MANAGE_FORBIDDEN");

    const wrongFormat = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ ...draftPayload, format: "SIX_V_SIX" }),
    });
    assert.equal(wrongFormat.status, 409);
    assert.equal(await errorCode(wrongFormat), "EVENT_FORMATION_FORMAT_MISMATCH");

    const wrongSlotCount = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ ...draftPayload, slots: slots.slice(0, 9) }),
    });
    assert.equal(wrongSlotCount.status, 400);
    assert.equal(await errorCode(wrongSlotCount), "EVENT_FORMATION_INVALID_SLOT_COUNT");

    const draftResponse = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify(draftPayload),
    });
    assert.equal(draftResponse.status, 201);

    const coachView = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      headers: { cookie: coach.cookie },
    });
    assert.equal(coachView.status, 200);
    const coachFormations = (await coachView.json()) as {
      name: string;
      published: boolean;
    }[];
    assert.deepEqual(
      coachFormations.map((formation) => formation.name),
      ["Draft five"],
    );
    assert.equal(coachFormations[0]?.published, false);

    const participantDraftView = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      headers: { cookie: playerA.cookie },
    });
    assert.equal(participantDraftView.status, 200);
    assert.deepEqual(await participantDraftView.json(), []);

    const outsiderView = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(outsiderView.status, 403);
    assert.equal(await errorCode(outsiderView), "EVENT_MEMBER_CONTENT_FORBIDDEN");

    const publishedResponse = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ ...draftPayload, name: "Published five", published: true }),
    });
    assert.equal(publishedResponse.status, 201);

    const participantPublishedView = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      headers: { cookie: playerA.cookie },
    });
    assert.equal(participantPublishedView.status, 200);
    const participantFormations = (await participantPublishedView.json()) as {
      name: string;
      published: boolean;
    }[];
    assert.deepEqual(
      participantFormations.map((formation) => formation.name),
      ["Published five"],
    );
    assert.equal(participantFormations[0]?.published, true);

    const cancel = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      method: "DELETE",
      headers: headers(playerA.cookie),
    });
    assert.equal(cancel.status, 200);

    const cancelledRsvp = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: playerA.userId } },
      select: { status: true },
    });
    assert.equal(cancelledRsvp.status, "CANCELLED");

    const cancelledPlayerSlots = await db.formationSlot.count({
      where: { userId: playerA.userId, formation: { eventId: event.id } },
    });
    assert.equal(cancelledPlayerSlots, 0);

    const otherPlayerSlots = await db.formationSlot.count({
      where: { userId: playerB.userId, formation: { eventId: event.id } },
    });
    assert.equal(otherPlayerSlots, 2);

    const storedFormations = await db.formation.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
      include: { slots: true },
    });
    assert.equal(storedFormations.length, 2);
    assert.deepEqual(
      storedFormations.map((formation) => formation.format),
      ["FIVE_V_FIVE", "FIVE_V_FIVE"],
    );
    assert.deepEqual(
      storedFormations.map((formation) => formation.slots.length),
      [10, 10],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await resetDatabase();
  }
});
