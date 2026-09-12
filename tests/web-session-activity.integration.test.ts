import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
import { PrismaUserLastSeenReader } from "../apps/api/src/modules/identity/infrastructure/prisma-user-last-seen.reader.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for WebSession activity integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "web-session-activity-test-token",
});
const db = getDatabaseClient();

async function register(
  base: string,
  suffix: string,
): Promise<{ cookie: string; userId: string }> {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: `activity_${suffix}`,
      displayUsername: `activity_${suffix}`,
      displayName: "Activity Runner",
      password: "correct horse battery staple",
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const me = await fetch(`${base}/api/v1/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  return { cookie, userId: ((await me.json()) as { id: string }).id };
}

test("web authentication throttles canonical WebSession lastSeenAt and batched reader returns it", async () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  let userId = "";
  try {
    const registered = await register(base, suffix);
    userId = registered.userId;
    const session = await db.webSession.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const stale = new Date(Date.now() - 5 * 60_000);
    await db.webSession.update({ where: { id: session.id }, data: { lastSeenAt: stale } });
    const touchedResponse = await fetch(`${base}/api/v1/me`, {
      headers: { cookie: registered.cookie },
    });
    assert.equal(touchedResponse.status, 200);
    const touched = await db.webSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.ok(touched.lastSeenAt.getTime() > stale.getTime());

    const recent = new Date();
    await db.webSession.update({ where: { id: session.id }, data: { lastSeenAt: recent } });
    const throttledResponse = await fetch(`${base}/api/v1/me`, {
      headers: { cookie: registered.cookie },
    });
    assert.equal(throttledResponse.status, 200);
    const throttled = await db.webSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(throttled.lastSeenAt.getTime(), recent.getTime());

    const reader = new PrismaUserLastSeenReader(db);
    const projected = await reader.findLastSeenByUserIds([userId, "missing-user"]);
    assert.equal(projected.get(userId)?.getTime(), recent.getTime());
    assert.equal(projected.get("missing-user"), null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (userId) await db.user.deleteMany({ where: { id: userId } });
  }
});
