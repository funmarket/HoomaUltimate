import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
import { nextUtcMidnight } from "../apps/api/src/modules/whistle/application/whistle.service.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Whistle history integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for Whistle history integration tests");

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
    body: JSON.stringify({ name: "Whistle History HOOMA", city: "Tunis", houma: "History" }),
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

test("Whistle history pages older active rows without extending the UTC-day boundary", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const users: Array<{ cookie: string; userId: string }> = [];
  const whistleIds: string[] = [];
  let communityId = "";

  try {
    for (let index = 0; index < 11; index += 1) {
      users.push(await register(base, `whistle_history_${index}_${suffix}`));
    }
    const community = await createCommunity(base, users[0]!.cookie);
    communityId = community.id;
    for (const member of users.slice(1)) {
      await joinCommunity(base, member.cookie, communityId);
    }

    const now = new Date();
    const expiresAt = nextUtcMidnight(now);
    const ttlMs = expiresAt.getTime() - now.getTime();
    const rows = Array.from({ length: 105 }, (_, index) => {
      const id = `history-${suffix}-${String(index).padStart(3, "0")}`;
      whistleIds.push(id);
      return {
        id,
        authorUserId: users[index % users.length]!.userId,
        contextType: "COMMUNITY" as const,
        contextId: communityId,
        createdAt: now,
        expiresAt,
      };
    });
    await db.whistleMetadata.createMany({ data: rows });
    for (const [index, id] of whistleIds.entries()) {
      assert.equal(
        await redisCommand(["SET", `whistle:body:${id}`, `history-body-${index}`, "PX", String(ttlMs)]),
        "OK",
      );
    }

    const listUrl = `${base}/api/v1/whistles/contexts/COMMUNITY/${communityId}`;
    const first = await fetch(listUrl, { headers: headers(users[0]!.cookie) });
    assert.equal(first.status, 200);
    const firstPayload = (await first.json()) as {
      items: Array<{ id: string; body: string }>;
      nextCursor: string | null;
      resetsAt: string;
    };
    assert.equal(firstPayload.items.length, 100);
    assert.ok(firstPayload.nextCursor);
    assert.equal(firstPayload.resetsAt, expiresAt.toISOString());

    const second = await fetch(`${listUrl}?cursor=${encodeURIComponent(firstPayload.nextCursor!)}`, {
      headers: headers(users[0]!.cookie),
    });
    assert.equal(second.status, 200);
    const secondPayload = (await second.json()) as {
      items: Array<{ id: string; body: string }>;
      nextCursor: string | null;
      resetsAt: string;
    };
    assert.equal(secondPayload.items.length, 5);
    assert.equal(secondPayload.nextCursor, null);
    assert.equal(secondPayload.resetsAt, expiresAt.toISOString());

    const allIds = [...firstPayload.items, ...secondPayload.items].map((item) => item.id);
    assert.equal(new Set(allIds).size, 105);
    assert.deepEqual(new Set(allIds), new Set(whistleIds));
    assert.ok([...firstPayload.items, ...secondPayload.items].every((item) => item.body.startsWith("history-body-")));

    const invalid = await fetch(`${listUrl}?cursor=not-a-valid-history-cursor`, {
      headers: headers(users[0]!.cookie),
    });
    assert.equal(invalid.status, 400);
  } finally {
    if (whistleIds.length) {
      await db.whistleMetadata.deleteMany({ where: { id: { in: whistleIds } } });
      await redisCommand(["DEL", ...whistleIds.map((id) => `whistle:body:${id}`)]).catch(() => null);
    }
    if (communityId) {
      await db.communityMembership.deleteMany({ where: { communityId } });
      await db.community.deleteMany({ where: { id: communityId } });
    }
    const userIds = users.map((user) => user.userId);
    if (userIds.length) {
      await db.webSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.webCredential.deleteMany({ where: { userId: { in: userIds } } });
      await db.userPresentation.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
