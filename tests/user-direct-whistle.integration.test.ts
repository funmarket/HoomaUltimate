import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for User Whistle integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for User Whistle integration tests");

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
  return { cookie, userId: credential.userId, username };
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

test("direct User Whistle derives one protected canonical User pair through the shared engine", async () => {
  await redisCommand(["FLUSHDB"]);
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdUserIds: string[] = [];

  try {
    const anonymousList = await fetch(`${base}/api/v1/whistles/users/no_user`, {
      headers: { origin: config.WEB_ORIGIN },
    });
    assert.equal(anonymousList.status, 401);

    const anonymousSend = await fetch(`${base}/api/v1/whistles/users/no_user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ body: "anonymous" }),
    });
    assert.equal(anonymousSend.status, 401);

    const sender = await register(base, `user_whistle_sender_${suffix}`);
    const target = await register(base, `user_whistle_target_${suffix}`);
    const outsider = await register(base, `user_whistle_outsider_${suffix}`);
    createdUserIds.push(sender.userId, target.userId, outsider.userId);

    const body = "meet at the pitch?";
    const sent = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(target.username.toUpperCase())}`,
      {
        method: "POST",
        headers: headers(sender.cookie),
        body: JSON.stringify({ body }),
      },
    );
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
    assert.equal(metadata.contextType, "USER_DIRECT");
    assert.equal(metadata.contextId, [sender.userId, target.userId].sort().join(":"));
    assert.equal(Object.hasOwn(metadata, "body"), false);

    const redisBody = await redisCommand(["GET", `whistle:body:${sentPayload.whistle.id}`]);
    assert.equal(redisBody, body);

    const reciprocal = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(sender.username)}`,
      { headers: headers(target.cookie) },
    );
    assert.equal(reciprocal.status, 200);
    const reciprocalPayload = (await reciprocal.json()) as {
      items: Array<{ id: string; body: string }>;
    };
    assert.equal(reciprocalPayload.items[0]?.id, sentPayload.whistle.id);
    assert.equal(reciprocalPayload.items[0]?.body, body);

    const outsiderList = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(sender.username)}`,
      { headers: headers(outsider.cookie) },
    );
    assert.equal(outsiderList.status, 200);
    const outsiderPayload = (await outsiderList.json()) as { items: Array<{ id: string }> };
    assert.equal(outsiderPayload.items.some((item) => item.id === sentPayload.whistle.id), false);

    const selfWhistle = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(sender.username)}`,
      {
        method: "POST",
        headers: headers(sender.cookie),
        body: JSON.stringify({ body: "self" }),
      },
    );
    assert.equal(selfWhistle.status, 400);

    const unknownWhistle = await fetch(`${base}/api/v1/whistles/users/not_a_real_${suffix}`, {
      method: "POST",
      headers: headers(sender.cookie),
      body: JSON.stringify({ body: "unknown" }),
    });
    assert.equal(unknownWhistle.status, 404);

    const rawContextAttempt = await fetch(
      `${base}/api/v1/whistles/contexts/USER_DIRECT/${encodeURIComponent(metadata.contextId)}`,
      { headers: headers(sender.cookie) },
    );
    assert.equal(rawContextAttempt.status, 400);

    const tooLong = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(target.username)}`,
      {
        method: "POST",
        headers: headers(sender.cookie),
        body: JSON.stringify({ body: "⚽".repeat(34) }),
      },
    );
    assert.equal(tooLong.status, 400);

    for (let index = 0; index < 10; index += 1) {
      const response = await fetch(
        `${base}/api/v1/whistles/users/${encodeURIComponent(target.username)}`,
        {
          method: "POST",
          headers: headers(sender.cookie),
          body: JSON.stringify({ body: `direct-${index}` }),
        },
      );
      assert.equal(response.status, 201);
    }
    const twelfth = await fetch(
      `${base}/api/v1/whistles/users/${encodeURIComponent(target.username)}`,
      {
        method: "POST",
        headers: headers(sender.cookie),
        body: JSON.stringify({ body: "quota-denied" }),
      },
    );
    assert.equal(twelfth.status, 429);
  } finally {
    if (createdUserIds.length) {
      await db.whistleMetadata.deleteMany({
        where: { authorUserId: { in: createdUserIds } },
      });
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
