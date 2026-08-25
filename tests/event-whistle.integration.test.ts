import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { Prisma, getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Event Whistle integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for Event Whistle integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

function encodeRedis(parts: readonly string[]): string {
  const payload = parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("");
  return `*${parts.length}\r\n${payload}`;
}

async function redisCommand(parts: readonly string[]): Promise<string | number | null> {
  const url = new URL(redisUrl!);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    let buffer = Buffer.alloc(0);
    socket.once("error", reject);
    socket.once("connect", () => socket.write(encodeRedis(parts)));
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const prefix = String.fromCharCode(buffer[0] ?? 0);
      const lineEnd = buffer.indexOf("\r\n");
      if (lineEnd < 0) return;
      const line = buffer.subarray(1, lineEnd).toString("utf8");
      if (prefix === "+") {
        socket.end();
        resolve(line);
        return;
      }
      if (prefix === ":") {
        socket.end();
        resolve(Number(line));
        return;
      }
      if (prefix === "-") {
        socket.destroy();
        reject(new Error(line));
        return;
      }
      if (prefix === "$") {
        const length = Number(line);
        if (length === -1) {
          socket.end();
          resolve(null);
          return;
        }
        const start = lineEnd + 2;
        if (buffer.length < start + length + 2) return;
        socket.end();
        resolve(buffer.subarray(start, start + length).toString("utf8"));
      }
    });
  });
}

async function resetTestData() {
  await db.$executeRaw(Prisma.sql`DELETE FROM "WhistleMetadata"`);
  await db.eventChatMessage.deleteMany();
  await db.eventChatRoom.deleteMany();
  await db.eventCheckIn.deleteMany();
  await db.formationSlot.deleteMany();
  await db.formation.deleteMany();
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
  await db.event.deleteMany();
  await db.playPlayerListing.deleteMany();
  await db.gamerProfile.deleteMany();
  await db.teamGame.deleteMany();
  await db.teamChallengeMessage.deleteMany();
  await db.teamChallenge.deleteMany();
  await db.teamLineupSlot.deleteMany();
  await db.teamLineup.deleteMany();
  await db.teamCapabilityGrant.deleteMany();
  await db.teamResponsibilityAssignment.deleteMany();
  await db.teamPlayer.deleteMany();
  await db.team.deleteMany();
  await db.communityJoinRequest.deleteMany();
  await db.communityMembership.deleteMany();
  await db.community.deleteMany();
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.outboxEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.gamerGame.deleteMany({ where: { createdByUserId: { not: null } } });
  await db.user.deleteMany();
  await redisCommand(["FLUSHDB"]);
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

async function createCommunity(base: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ name: "Event Whistle HOOMA", city: "Tunis", houma: "Test" }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

async function joinCommunity(base: string, cookie: string, communityId: string) {
  const response = await fetch(`${base}/api/v1/communities/${communityId}/join`, {
    method: "POST",
    headers: headers(cookie),
  });
  assert.equal(response.status, 201);
}

async function createEvent(base: string, cookie: string, communityId: string) {
  const response = await fetch(`${base}/api/v1/events`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      communityId,
      type: "PLAY",
      title: "Event Whistle Match",
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      timezone: "Africa/Tunis",
      capacity: 1,
      waitlistEnabled: true,
      entryFeeMinor: 0,
      currency: "TND",
      play: { pitchType: "FIVE_A_SIDE", skillLevel: "MIXED", format: "FIVE_V_FIVE" },
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

function whistlePath(contextType: "COMMUNITY" | "EVENT" | "TEAM", contextId: string) {
  return `/api/v1/whistles/contexts/${contextType}/${contextId}`;
}

async function sendWhistle(
  base: string,
  cookie: string,
  contextType: "COMMUNITY" | "EVENT",
  contextId: string,
  body: string,
) {
  return fetch(`${base}${whistlePath(contextType, contextId)}`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ body }),
  });
}

test("Event Whistle reuses canonical Event access and the global Whistle quota", async () => {
  await resetTestData();
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "event_whistle_founder");
    const coach = await register(base, "event_whistle_coach");
    const confirmed = await register(base, "event_whistle_confirmed");
    const waitlisted = await register(base, "event_whistle_waitlisted");
    const outsider = await register(base, "event_whistle_outsider");

    const community = await createCommunity(base, founder.cookie);
    await joinCommunity(base, coach.cookie, community.id);
    const appointCoach = await fetch(`${base}/api/v1/communities/${community.id}/coaches`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ userId: coach.userId }),
    });
    assert.equal(appointCoach.status, 201);

    const event = await createEvent(base, coach.cookie, community.id);
    const eventPath = whistlePath("EVENT", event.id);

    assert.equal((await fetch(`${base}${eventPath}`)).status, 401);
    assert.equal(
      (await fetch(`${base}${eventPath}`, { headers: headers(outsider.cookie) })).status,
      403,
    );
    assert.equal(
      (await sendWhistle(base, outsider.cookie, "EVENT", event.id, "not allowed")).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}${eventPath}`, { headers: headers(coach.cookie) })).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}${eventPath}`, { headers: headers(founder.cookie) })).status,
      200,
    );

    const confirmedJoin = await fetch(`${base}/api/v1/events/${event.id}/join`, {
      method: "POST",
      headers: headers(confirmed.cookie),
    });
    assert.equal(confirmedJoin.status, 200);
    assert.equal(((await confirmedJoin.json()) as { status: string }).status, "CONFIRMED");

    const waitlistedJoin = await fetch(`${base}/api/v1/events/${event.id}/join`, {
      method: "POST",
      headers: headers(waitlisted.cookie),
    });
    assert.equal(waitlistedJoin.status, 200);
    assert.equal(((await waitlistedJoin.json()) as { status: string }).status, "WAITLISTED");

    const confirmedSend = await sendWhistle(
      base,
      confirmed.cookie,
      "EVENT",
      event.id,
      "boots ready",
    );
    assert.equal(confirmedSend.status, 201);
    const confirmedPayload = (await confirmedSend.json()) as {
      whistle: { id: string; body: string };
      remainingToday: number;
    };
    assert.equal(confirmedPayload.whistle.body, "boots ready");
    assert.equal(confirmedPayload.remainingToday, 10);

    const waitlistedList = await fetch(`${base}${eventPath}`, {
      headers: headers(waitlisted.cookie),
    });
    assert.equal(waitlistedList.status, 200);
    const waitlistedPayload = (await waitlistedList.json()) as {
      items: Array<{ id: string; body: string }>;
    };
    assert.equal(
      waitlistedPayload.items.find((item) => item.id === confirmedPayload.whistle.id)?.body,
      "boots ready",
    );

    const metadata = await db.$queryRaw<Array<{ contextType: string; json: string }>>(Prisma.sql`
      SELECT "contextType"::text AS "contextType", to_jsonb(w)::text AS json
      FROM "WhistleMetadata" w
      WHERE w."id" = ${confirmedPayload.whistle.id}
    `);
    assert.equal(metadata[0]?.contextType, "EVENT");
    assert.equal(metadata[0]?.json.includes("boots ready"), false);

    const communitySend = await sendWhistle(
      base,
      founder.cookie,
      "COMMUNITY",
      community.id,
      "community signal",
    );
    assert.equal(communitySend.status, 201);
    assert.equal(((await communitySend.json()) as { remainingToday: number }).remainingToday, 10);
    const eventSend = await sendWhistle(base, founder.cookie, "EVENT", event.id, "event signal");
    assert.equal(eventSend.status, 201);
    assert.equal(((await eventSend.json()) as { remainingToday: number }).remainingToday, 9);

    const cancelConfirmed = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      method: "DELETE",
      headers: headers(confirmed.cookie),
    });
    assert.equal(cancelConfirmed.status, 200);
    assert.equal(
      (await fetch(`${base}${eventPath}`, { headers: headers(confirmed.cookie) })).status,
      403,
    );

    const promoted = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      headers: headers(waitlisted.cookie),
    });
    assert.equal(promoted.status, 200);
    assert.equal(
      ((await promoted.json()) as { rsvp: { status: string } | null }).rsvp?.status,
      "CONFIRMED",
    );

    const disabledTeamContext = await fetch(
      `${base}${whistlePath("TEAM", "not-enabled")}`,
      { headers: headers(founder.cookie) },
    );
    assert.equal(disabledTeamContext.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    await resetTestData();
  }
});
