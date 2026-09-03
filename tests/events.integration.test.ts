import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Events integration tests");
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
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
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
  return { cookie: cookie!, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("Play event preserves waitlist and separates check-in evidence from final attendance", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "event_founder");
    const playerA = await register(base, "event_player_a");
    const playerB = await register(base, "event_player_b");
    const playerC = await register(base, "event_player_c");

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ name: "Medina Matchday" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const startsAt = new Date(Date.now() + 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60_000);
    const eventResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        communityId: community.id,
        type: "PLAY",
        title: "Friday Five-a-side",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: 2,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        play: { pitchType: "FIVE_A_SIDE", skillLevel: "MIXED", format: "FIVE_V_FIVE" },
      }),
    });
    assert.equal(eventResponse.status, 201);
    const event = (await eventResponse.json()) as { id: string };

    const players = [playerA, playerB, playerC];
    const joins = await Promise.all(
      players.map((player) =>
        fetch(`${base}/api/v1/events/${event.id}/join`, {
          method: "POST",
          headers: headers(player.cookie),
        }),
      ),
    );
    joins.forEach((response) => assert.equal(response.status, 200));
    const joinStatuses = await Promise.all(joins.map((response) => response.json() as Promise<{ status: string }>));
    assert.deepEqual(
      joinStatuses.map((result) => result.status).sort(),
      ["CONFIRMED", "CONFIRMED", "WAITLISTED"],
    );

    const waitlistedIndex = joinStatuses.findIndex((result) => result.status === "WAITLISTED");
    const confirmedIndexes = joinStatuses
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "CONFIRMED")
      .map(({ index }) => index);
    const waitlisted = players[waitlistedIndex]!;
    const cancelledConfirmed = players[confirmedIndexes[0]!]!;
    const absentConfirmed = players[confirmedIndexes[1]!]!;

    const cancel = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      method: "DELETE",
      headers: headers(cancelledConfirmed.cookie),
    });
    assert.equal(cancel.status, 200);
    const cancelled = (await cancel.json()) as { promotedUserId: string | null };
    assert.equal(cancelled.promotedUserId, waitlisted.userId);

    const promoted = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: waitlisted.userId } },
    });
    assert.equal(promoted.status, "CONFIRMED");

    const formation = await fetch(`${base}/api/v1/events/${event.id}/formations`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: "Balanced five",
        format: "FIVE_V_FIVE",
        published: true,
        slots: [
          { userId: waitlisted.userId, team: "A", position: "GK", label: "Keeper", x: 10, y: 50 },
        ],
      }),
    });
    assert.equal(formation.status, 201);

    const checkIn = await fetch(`${base}/api/v1/events/${event.id}/check-in`, {
      method: "POST",
      headers: headers(waitlisted.cookie),
      body: JSON.stringify({ latitude: 36.8065, longitude: 10.1815 }),
    });
    assert.equal(checkIn.status, 200);
    const firstCheckIn = (await checkIn.json()) as { checkedIn: boolean; checkedInAt: string };
    assert.equal(firstCheckIn.checkedIn, true);

    const afterCheckIn = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: waitlisted.userId } },
    });
    assert.equal(afterCheckIn.status, "CONFIRMED");
    assert.equal(
      await db.eventCheckIn.count({ where: { eventId: event.id, userId: waitlisted.userId } }),
      1,
    );

    const participationResponse = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      headers: { cookie: waitlisted.cookie },
    });
    assert.equal(participationResponse.status, 200);
    const participation = (await participationResponse.json()) as {
      rsvp: { status: string } | null;
      checkIn: { checkedInAt: string } | null;
    };
    assert.equal(participation.rsvp?.status, "CONFIRMED");
    assert.equal(participation.checkIn?.checkedInAt, firstCheckIn.checkedInAt);

    const repeatCheckIn = await fetch(`${base}/api/v1/events/${event.id}/check-in`, {
      method: "POST",
      headers: headers(waitlisted.cookie),
      body: JSON.stringify({ latitude: 35, longitude: 9 }),
    });
    assert.equal(repeatCheckIn.status, 200);
    const repeated = (await repeatCheckIn.json()) as { checkedInAt: string };
    assert.equal(repeated.checkedInAt, firstCheckIn.checkedInAt);
    assert.equal(
      await db.eventCheckIn.count({ where: { eventId: event.id, userId: waitlisted.userId } }),
      1,
    );
    const persistedCheckIn = await db.eventCheckIn.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: waitlisted.userId } },
    });
    assert.equal(Number(persistedCheckIn.latitude), 36.8065);
    assert.equal(Number(persistedCheckIn.longitude), 10.1815);

    const cancelAfterCheckIn = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      method: "DELETE",
      headers: headers(waitlisted.cookie),
    });
    assert.equal(cancelAfterCheckIn.status, 409);
    const cancelError = (await cancelAfterCheckIn.json()) as { error: { code: string } };
    assert.equal(cancelError.error.code, "RSVP_CHECKED_IN_CANCELLATION_FORBIDDEN");

    const chatPost = await fetch(`${base}/api/v1/events/${event.id}/chat/messages`, {
      method: "POST",
      headers: headers(waitlisted.cookie),
      body: JSON.stringify({ body: "See you on the pitch." }),
    });
    assert.equal(chatPost.status, 201);
    const chat = await fetch(`${base}/api/v1/events/${event.id}/chat`, {
      headers: { cookie: waitlisted.cookie },
    });
    assert.equal(chat.status, 200);
    const chatRows = (await chat.json()) as { body: string }[];
    assert.equal(chatRows.at(-1)?.body, "See you on the pitch.");

    const paidEvent = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        communityId: community.id,
        type: "PLAY",
        title: "Paid event not wired yet",
        startsAt: startsAt.toISOString(),
        entryFeeMinor: 1000,
        play: { pitchType: "FIVE_A_SIDE", skillLevel: "MIXED", format: "FIVE_V_FIVE" },
      }),
    });
    assert.equal(paidEvent.status, 409);

    const complete = await fetch(`${base}/api/v1/events/${event.id}/complete`, {
      method: "POST",
      headers: headers(founder.cookie),
    });
    assert.equal(complete.status, 200);
    const completed = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(completed.status, "COMPLETED");

    const attended = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: waitlisted.userId } },
    });
    assert.equal(attended.status, "ATTENDED");
    const noShow = await db.eventRsvp.findUniqueOrThrow({
      where: { eventId_userId: { eventId: event.id, userId: absentConfirmed.userId } },
    });
    assert.equal(noShow.status, "NO_SHOW");

    const lateCheckIn = await fetch(`${base}/api/v1/events/${event.id}/check-in`, {
      method: "POST",
      headers: headers(absentConfirmed.cookie),
      body: JSON.stringify({}),
    });
    assert.equal(lateCheckIn.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});

test("public Watch listing filters by Place and Watch does not inherit Play check-in", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const creator = await register(base, "watch_pagination_creator");
    const suffix = Date.now().toString(36);
    const placeA = await db.place.create({
      data: {
        slug: `watch-page-a-${suffix}`,
        name: "Watch Page A",
        address: "10 First Street",
        moderationStatus: "APPROVED",
        suggestedByUserId: creator.userId,
      },
    });
    const placeB = await db.place.create({
      data: {
        slug: `watch-page-b-${suffix}`,
        name: "Watch Page B",
        address: "20 Second Street",
        moderationStatus: "APPROVED",
        suggestedByUserId: creator.userId,
      },
    });

    const startsAt = new Date(Date.now() + 60 * 60_000);
    async function createWatch(placeId: string, title: string, offsetMinutes: number) {
      const response = await fetch(`${base}/api/v1/events`, {
        method: "POST",
        headers: headers(creator.cookie),
        body: JSON.stringify({
          communityId: null,
          placeId,
          type: "WATCH",
          title,
          startsAt: new Date(startsAt.getTime() + offsetMinutes * 60_000).toISOString(),
          timezone: "Africa/Tunis",
          waitlistEnabled: true,
          entryFeeMinor: 0,
          currency: "TND",
          play: null,
          watch: {
            teamOneName: `${title} Home`,
            teamTwoName: `${title} Away`,
          },
        }),
      });
      assert.equal(response.status, 201);
      return (await response.json()) as { id: string };
    }

    const firstA = await createWatch(placeA.id, "First A", 0);
    const secondA = await createWatch(placeA.id, "Second A", 30);
    await createWatch(placeB.id, "Only B", 15);

    const joinWatch = await fetch(`${base}/api/v1/events/${firstA.id}/join`, {
      method: "POST",
      headers: headers(creator.cookie),
    });
    assert.equal(joinWatch.status, 200);
    const watchCheckIn = await fetch(`${base}/api/v1/events/${firstA.id}/check-in`, {
      method: "POST",
      headers: headers(creator.cookie),
      body: JSON.stringify({}),
    });
    assert.equal(watchCheckIn.status, 409);
    const watchError = (await watchCheckIn.json()) as { error: { code: string } };
    assert.equal(watchError.error.code, "EVENT_CHECK_IN_NOT_AVAILABLE");
    assert.equal(await db.eventCheckIn.count({ where: { eventId: firstA.id } }), 0);

    const firstPageResponse = await fetch(
      `${base}/api/public/v1/events?type=WATCH&placeId=${placeA.id}&limit=1`,
    );
    assert.equal(firstPageResponse.status, 200);
    const firstPage = (await firstPageResponse.json()) as {
      items: { id: string; placeId: string | null }[];
      nextCursor: string | null;
    };
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.items[0]?.id, firstA.id);
    assert.equal(firstPage.items[0]?.placeId, placeA.id);
    assert.equal(firstPage.nextCursor, firstA.id);

    const secondPageResponse = await fetch(
      `${base}/api/public/v1/events?type=WATCH&placeId=${placeA.id}&limit=1&cursor=${firstPage.nextCursor}`,
    );
    assert.equal(secondPageResponse.status, 200);
    const secondPage = (await secondPageResponse.json()) as {
      items: { id: string; placeId: string | null }[];
      nextCursor: string | null;
    };
    assert.equal(secondPage.items.length, 1);
    assert.equal(secondPage.items[0]?.id, secondA.id);
    assert.equal(secondPage.items[0]?.placeId, placeA.id);
    assert.equal(secondPage.nextCursor, null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
