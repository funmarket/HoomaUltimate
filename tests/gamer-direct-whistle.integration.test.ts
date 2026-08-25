import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Gamer Whistle integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for Gamer Whistle integration tests");

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

function nextUtcMidnight(value: string): string {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  ).toISOString();
}

test("direct Gamer Whistle resolves one protected same-game pair through the shared Whistle engine", async () => {
  await redisCommand(["FLUSHDB"]);
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdUserIds: string[] = [];
  let gameId = "";

  try {
    const sender = await register(base, `gamer_whistle_sender_${suffix}`);
    const target = await register(base, `gamer_whistle_target_${suffix}`);
    const outsider = await register(base, `gamer_whistle_outsider_${suffix}`);
    const closed = await register(base, `gamer_whistle_closed_${suffix}`);
    createdUserIds.push(sender.userId, target.userId, outsider.userId, closed.userId);

    await db.user.updateMany({
      where: { id: { in: createdUserIds } },
      data: { identities: { set: ["GAMER"] } },
    });

    const game = await db.gamerGame.create({
      data: {
        name: `Direct Whistle ${suffix}`,
        normalizedName: `direct whistle ${suffix}`,
        slug: `direct-whistle-${suffix}`,
      },
    });
    gameId = game.id;

    const senderProfile = await db.gamerProfile.create({
      data: {
        userId: sender.userId,
        gameId,
        handle: "SENDER",
        openToChallenge: true,
      },
    });
    const targetProfile = await db.gamerProfile.create({
      data: {
        userId: target.userId,
        gameId,
        handle: "TARGET",
        openToChallenge: true,
      },
    });
    const closedProfile = await db.gamerProfile.create({
      data: {
        userId: closed.userId,
        gameId,
        handle: "CLOSED",
        openToChallenge: false,
      },
    });

    const body = "ready for a match?";
    const sent = await fetch(`${base}/api/v1/whistles/gamers/${targetProfile.id}`, {
      method: "POST",
      headers: headers(sender.cookie),
      body: JSON.stringify({ body }),
    });
    assert.equal(sent.status, 201);
    const sentPayload = (await sent.json()) as {
      whistle: { id: string; body: string; createdAt: string; expiresAt: string };
      remainingToday: number;
      resetsAt: string;
    };
    assert.equal(sentPayload.whistle.body, body);
    assert.equal(sentPayload.remainingToday, 10);
    assert.equal(sentPayload.whistle.expiresAt, nextUtcMidnight(sentPayload.whistle.createdAt));
    assert.equal(sentPayload.resetsAt, sentPayload.whistle.expiresAt);

    const metadata = await db.whistleMetadata.findUniqueOrThrow({
      where: { id: sentPayload.whistle.id },
    });
    assert.equal(metadata.contextType, "GAMER_DIRECT");
    assert.ok(metadata.contextId.startsWith(`${gameId}:`));
    assert.equal(Object.hasOwn(metadata, "body"), false);

    const redisBody = await redisCommand(["GET", `whistle:body:${sentPayload.whistle.id}`]);
    assert.equal(redisBody, body);

    const reciprocal = await fetch(`${base}/api/v1/whistles/gamers/${senderProfile.id}`, {
      headers: headers(target.cookie),
    });
    assert.equal(reciprocal.status, 200);
    const reciprocalPayload = (await reciprocal.json()) as {
      items: Array<{ id: string; body: string }>;
    };
    assert.equal(reciprocalPayload.items.length, 1);
    assert.equal(reciprocalPayload.items[0]?.id, sentPayload.whistle.id);
    assert.equal(reciprocalPayload.items[0]?.body, body);

    const selfWhistle = await fetch(`${base}/api/v1/whistles/gamers/${senderProfile.id}`, {
      method: "POST",
      headers: headers(sender.cookie),
      body: JSON.stringify({ body: "self" }),
    });
    assert.equal(selfWhistle.status, 400);

    const outsiderWhistle = await fetch(`${base}/api/v1/whistles/gamers/${targetProfile.id}`, {
      method: "POST",
      headers: headers(outsider.cookie),
      body: JSON.stringify({ body: "outsider" }),
    });
    assert.equal(outsiderWhistle.status, 409);

    const closedWhistle = await fetch(`${base}/api/v1/whistles/gamers/${closedProfile.id}`, {
      method: "POST",
      headers: headers(sender.cookie),
      body: JSON.stringify({ body: "closed" }),
    });
    assert.equal(closedWhistle.status, 409);

    const rawContextAttempt = await fetch(
      `${base}/api/v1/whistles/contexts/GAMER_DIRECT/${encodeURIComponent(metadata.contextId)}`,
      { headers: headers(sender.cookie) },
    );
    assert.equal(rawContextAttempt.status, 400);
  } finally {
    if (gameId) {
      await db.whistleMetadata.deleteMany({ where: { contextType: "GAMER_DIRECT" } });
      await db.gamerProfile.deleteMany({ where: { gameId } });
      await db.gamerGame.deleteMany({ where: { id: gameId } });
    }
    if (createdUserIds.length) {
      await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await redisCommand(["FLUSHDB"]);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
