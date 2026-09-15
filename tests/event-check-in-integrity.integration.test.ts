import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Event check-in integration tests");
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
  return {
    cookie,
    origin: config.WEB_ORIGIN,
    "content-type": "application/json",
  };
}

async function createCommunity(base: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ name: "Check-in Integrity" }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

async function createPlayEvent(base: string, cookie: string, communityId: string) {
  const startsAt = new Date(Date.now() + 2 * 60 * 60_000);
  const response = await fetch(`${base}/api/v1/events`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      communityId,
      type: "PLAY",
      title: "Check-in contract",
      startsAt: startsAt.toISOString(),
      capacity: 20,
      waitlistEnabled: true,
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

async function join(base: string, eventId: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/events/${eventId}/join`, {
    method: "POST",
    headers: headers(cookie),
  });
  assert.equal(response.status, 200);
}

async function checkIn(
  base: string,
  eventId: string,
  cookie: string,
  location: { latitude?: number; longitude?: number } = {},
) {
  return fetch(`${base}/api/v1/events/${eventId}/check-in`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify(location),
  });
}

async function expectError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, code);
}

test("Event check-in integrity contract", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "checkin_founder");
    const coach = await register(base, "checkin_coach");
    const early = await register(base, "checkin_early");
    const t60 = await register(base, "checkin_t60");
    const t30 = await register(base, "checkin_t30");
    const atStart = await register(base, "checkin_start");
    const afterStart = await register(base, "checkin_after");
    const waitlisted = await register(base, "checkin_waitlisted");
    const cancelled = await register(base, "checkin_cancelled");
    const missing = await register(base, "checkin_missing");
    const lifecycle = await register(base, "checkin_lifecycle");
    const watchPlayer = await register(base, "checkin_watch");
    const racing = await register(base, "checkin_race");
    const concurrent = await register(base, "checkin_concurrent");
    const community = await createCommunity(base, founder.cookie);
    const event = await createPlayEvent(base, founder.cookie, community.id);

    await db.communityMembership.create({
      data: {
        communityId: community.id,
        userId: coach.userId,
        role: "COACH",
      },
    });

    const creatorAttempt = await checkIn(base, event.id, founder.cookie);
    await expectError(creatorAttempt, 409, "EVENT_CREATOR_PARTICIPATION_FORBIDDEN");
    assert.equal(await db.eventRsvp.count({ where: { eventId: event.id } }), 0);
    assert.equal(await db.eventCheckIn.count({ where: { eventId: event.id } }), 0);

    await join(base, event.id, coach.cookie);
    await db.event.update({
      where: { id: event.id },
      data: { startsAt: new Date(Date.now() + 30 * 60_000) },
    });
    const coachCheckIn = await checkIn(base, event.id, coach.cookie);
    assert.equal(coachCheckIn.status, 200);

    await join(base, event.id, early.cookie);
    await db.event.update({
      where: { id: event.id },
      data: { startsAt: new Date(Date.now() + 61 * 60_000) },
    });
    const tooEarly = await checkIn(base, event.id, early.cookie);
    await expectError(tooEarly, 409, "EVENT_CHECK_IN_NOT_OPEN");

    for (const [player, offsetMs] of [
      [t60, 60 * 60_000],
      [t30, 30 * 60_000],
      [atStart, 0],
      [afterStart, -30 * 60_000],
    ] as const) {
      await join(base, event.id, player.cookie);
      await db.event.update({
        where: { id: event.id },
        data: { startsAt: new Date(Date.now() + offsetMs) },
      });
      const response = await checkIn(base, event.id, player.cookie);
      assert.equal(response.status, 200);
    }

    const firstCheckIn = await db.eventCheckIn.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: t60.userId } },
    });
    const firstRsvp = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: t60.userId } },
    });
    const repeated = await checkIn(base, event.id, t60.cookie, {
      latitude: 36.8,
      longitude: 10.18,
    });
    assert.equal(repeated.status, 200);
    const repeatedCheckIn = await db.eventCheckIn.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: t60.userId } },
    });
    const repeatedRsvp = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: t60.userId } },
    });
    assert.equal(repeatedCheckIn.id, firstCheckIn.id);
    assert.equal(repeatedCheckIn.createdAt.getTime(), firstCheckIn.createdAt.getTime());
    assert.equal(repeatedCheckIn.latitude, firstCheckIn.latitude);
    assert.equal(repeatedCheckIn.longitude, firstCheckIn.longitude);
    assert.equal(repeatedRsvp.checkedInAt?.getTime(), firstRsvp.checkedInAt?.getTime());

    await db.eventRsvp.create({
      data: { eventId: event.id, userId: waitlisted.userId, status: "WAITLISTED" },
    });
    await db.eventRsvp.create({
      data: { eventId: event.id, userId: cancelled.userId, status: "CANCELLED" },
    });
    for (const player of [waitlisted, cancelled, missing]) {
      const response = await checkIn(base, event.id, player.cookie);
      await expectError(response, 403, "EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP");
    }

    await db.eventRsvp.create({
      data: { eventId: event.id, userId: lifecycle.userId, status: "CONFIRMED" },
    });
    await db.event.update({
      where: { id: event.id },
      data: { status: "CANCELLED" },
    });
    const cancelledEvent = await checkIn(base, event.id, lifecycle.cookie);
    await expectError(cancelledEvent, 409, "EVENT_NOT_ACTIVE");
    await db.event.update({
      where: { id: event.id },
      data: { status: "COMPLETED" },
    });
    const completedEvent = await checkIn(base, event.id, lifecycle.cookie);
    await expectError(completedEvent, 409, "EVENT_NOT_ACTIVE");

    const watchEvent = await db.event.create({
      data: {
        communityId: community.id,
        createdByUserId: founder.userId,
        type: "WATCH",
        title: "Watch check-in",
        startsAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    await db.eventRsvp.create({
      data: {
        eventId: watchEvent.id,
        userId: watchPlayer.userId,
        status: "CONFIRMED",
      },
    });
    const watchCheckIn = await checkIn(base, watchEvent.id, watchPlayer.cookie);
    assert.equal(watchCheckIn.status, 200);

    const raceEvent = await db.event.create({
      data: {
        communityId: community.id,
        createdByUserId: founder.userId,
        type: "PLAY",
        title: "Race check-in",
        startsAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    await db.playEventDetails.create({
      data: {
        eventId: raceEvent.id,
        pitchType: "FIVE_A_SIDE",
        skillLevel: "MIXED",
        format: "FIVE_V_FIVE",
      },
    });
    await db.eventRsvp.create({
      data: {
        eventId: raceEvent.id,
        userId: racing.userId,
        status: "CONFIRMED",
      },
    });

    const [cancelRace, checkInRace] = await Promise.all([
      fetch(`${base}/api/v1/events/${raceEvent.id}/rsvp`, {
        method: "DELETE",
        headers: headers(racing.cookie),
      }),
      checkIn(base, raceEvent.id, racing.cookie),
    ]);
    const raceSuccesses = [cancelRace.status, checkInRace.status].filter(
      (status) => status === 200,
    );
    assert.equal(raceSuccesses.length, 1);

    const raceRsvp = await db.eventRsvp.findUniqueOrThrow({
      where: {
        eventId_userId: { eventId: raceEvent.id, userId: racing.userId },
      },
    });
    const raceCheckIns = await db.eventCheckIn.count({
      where: { eventId: raceEvent.id, userId: racing.userId },
    });
    if (raceRsvp.status === "ATTENDED") {
      assert.equal(raceCheckIns, 1);
      assert.equal(cancelRace.status, 409);
      assert.equal(checkInRace.status, 200);
    } else {
      assert.equal(raceRsvp.status, "CANCELLED");
      assert.equal(raceCheckIns, 0);
      assert.equal(cancelRace.status, 200);
      assert.equal(checkInRace.status, 403);
    }

    await db.eventRsvp.create({
      data: {
        eventId: raceEvent.id,
        userId: concurrent.userId,
        status: "CONFIRMED",
      },
    });
    const [concurrentA, concurrentB] = await Promise.all([
      checkIn(base, raceEvent.id, concurrent.cookie),
      checkIn(base, raceEvent.id, concurrent.cookie),
    ]);
    assert.equal(concurrentA.status, 200);
    assert.equal(concurrentB.status, 200);
    assert.equal(
      await db.eventCheckIn.count({
        where: { eventId: raceEvent.id, userId: concurrent.userId },
      }),
      1,
    );
    const concurrentRsvp = await db.eventRsvp.findUniqueOrThrow({
      where: {
        eventId_userId: { eventId: raceEvent.id, userId: concurrent.userId },
      },
    });
    assert.equal(concurrentRsvp.status, "ATTENDED");
    assert.ok(concurrentRsvp.checkedInAt);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await resetDatabase();
  }
});
