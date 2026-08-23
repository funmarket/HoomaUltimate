import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { Prisma, getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Whistle integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for Whistle integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token"
});
const db = getDatabaseClient();

function encodeRedis(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
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
      if (prefix === "+") { socket.end(); resolve(line); return; }
      if (prefix === ":") { socket.end(); resolve(Number(line)); return; }
      if (prefix === "-") { socket.destroy(); reject(new Error(line)); return; }
      if (prefix === "$") {
        const length = Number(line);
        if (length === -1) { socket.end(); resolve(null); return; }
        const start = lineEnd + 2;
        if (buffer.length < start + length + 2) return;
        socket.end();
        resolve(buffer.subarray(start, start + length).toString("utf8"));
      }
    });
  });
}

async function resetDatabase() {
  await db.$executeRaw(Prisma.sql`DELETE FROM "WhistleMetadata"`);
  await db.eventChatMessage.deleteMany();
  await db.eventChatRoom.deleteMany();
  await db.eventCheckIn.deleteMany();
  await db.formationSlot.deleteMany();
  await db.formation.deleteMany();
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
  await db.event.deleteMany();
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
  await db.outboxEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
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
      displayName: username
    })
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const credential = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: username } });
  return { cookie, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

async function createCommunity(base: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ name: "Whistle HOOMA", city: "Tunis", houma: "Test" })
  });
  assert.equal(response.status, 201);
  return await response.json() as { id: string };
}

async function joinCommunity(base: string, cookie: string, communityId: string) {
  const response = await fetch(`${base}/api/v1/communities/${communityId}/join`, { method: "POST", headers: headers(cookie) });
  assert.equal(response.status, 201);
}

async function sendWhistle(base: string, cookie: string, communityId: string, body: string) {
  return fetch(`${base}/api/v1/whistles/contexts/COMMUNITY/${communityId}`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ body })
  });
}

test("Whistle enforces private context, global quota, Redis TTL/reveal and metadata-only persistence", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "whistle_founder");
    const member = await register(base, "whistle_member");
    const concurrent = await register(base, "whistle_concurrent");
    const outsider = await register(base, "whistle_outsider");
    const community = await createCommunity(base, founder.cookie);
    await joinCommunity(base, member.cookie, community.id);
    await joinCommunity(base, concurrent.cookie, community.id);

    const outsiderList = await fetch(`${base}/api/v1/whistles/contexts/COMMUNITY/${community.id}`, { headers: headers(outsider.cookie) });
    assert.equal(outsiderList.status, 403);

    const durableSecret = "secret-body-never-persisted";
    const first = await sendWhistle(base, founder.cookie, community.id, durableSecret);
    assert.equal(first.status, 201);
    const firstPayload = await first.json() as { whistle: { id: string }; remainingToday: number };
    assert.equal(firstPayload.remainingToday, 10);
    const whistleId = firstPayload.whistle.id;

    const bodyTtl = await redisCommand(["TTL", `whistle:body:${whistleId}`]);
    assert.equal(typeof bodyTtl, "number");
    assert.ok((bodyTtl as number) > 86_300 && (bodyTtl as number) <= 86_400);

    const list = await fetch(`${base}/api/v1/whistles/contexts/COMMUNITY/${community.id}`, { headers: headers(member.cookie) });
    assert.equal(list.status, 200);
    const listText = await list.text();
    assert.equal(listText.includes(durableSecret), false);

    const reveal = await fetch(`${base}/api/v1/whistles/${whistleId}/reveal`, { method: "POST", headers: headers(member.cookie) });
    assert.equal(reveal.status, 200);
    const revealPayload = await reveal.json() as { body: string; visibleForSeconds: number };
    assert.equal(revealPayload.body, durableSecret);
    assert.equal(revealPayload.visibleForSeconds, 60);

    const firstWindowTtl = await redisCommand(["TTL", `whistle:reveal:${whistleId}:${member.userId}`]);
    assert.equal(typeof firstWindowTtl, "number");
    assert.ok((firstWindowTtl as number) > 0 && (firstWindowTtl as number) <= 60);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const revealAgain = await fetch(`${base}/api/v1/whistles/${whistleId}/reveal`, { method: "POST", headers: headers(member.cookie) });
    assert.equal(revealAgain.status, 200);
    const secondWindowTtl = await redisCommand(["TTL", `whistle:reveal:${whistleId}:${member.userId}`]);
    assert.equal(typeof secondWindowTtl, "number");
    assert.ok((secondWindowTtl as number) < (firstWindowTtl as number));

    await redisCommand(["EXPIRE", `whistle:reveal:${whistleId}:${member.userId}`, "1"]);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const expiredReveal = await fetch(`${base}/api/v1/whistles/${whistleId}/reveal`, { method: "POST", headers: headers(member.cookie) });
    assert.equal(expiredReveal.status, 410);
    assert.equal(await redisCommand(["EXISTS", `whistle:seen:${whistleId}:${member.userId}`]), 1);

    const metadataJson = await db.$queryRaw<{ json: string }[]>(Prisma.sql`
      SELECT to_jsonb(w)::text AS json FROM "WhistleMetadata" w WHERE w."id" = ${whistleId}
    `);
    assert.equal(metadataJson[0]?.json.includes(durableSecret), false);
    const durablePayloadCount = await db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "OutboxEvent" WHERE "payload"::text LIKE ${`%${durableSecret}%`}
    `);
    assert.equal(Number(durablePayloadCount[0]?.count ?? 0n), 0);

    for (let index = 0; index < 10; index += 1) {
      const response = await sendWhistle(base, founder.cookie, community.id, `quota-${index}`);
      assert.equal(response.status, 201);
    }
    const twelfth = await sendWhistle(base, founder.cookie, community.id, "quota-denied");
    assert.equal(twelfth.status, 429);

    const concurrentAttempts = await Promise.all(
      Array.from({ length: 12 }, (_, index) => sendWhistle(base, concurrent.cookie, community.id, `race-${index}`))
    );
    assert.equal(concurrentAttempts.filter((response) => response.status === 201).length, 11);
    assert.equal(concurrentAttempts.filter((response) => response.status === 429).length, 1);

    const tooLong = await sendWhistle(base, member.cookie, community.id, "⚽".repeat(34));
    assert.equal(tooLong.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
