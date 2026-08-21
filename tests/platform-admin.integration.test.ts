import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for platform-admin integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token"
});
const db = getDatabaseClient();

async function resetDatabase() {
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

async function register(base: string, loginUsername: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername,
      password: "correct horse battery staple",
      displayUsername: loginUsername,
      displayName: loginUsername
    })
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie!;
}

test("global admin route rejects normal members and accepts PLATFORM_ADMIN only", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const memberCookie = await register(base, "member");
    const denied = await fetch(`${base}/api/v1/admin/overview`, { headers: { cookie: memberCookie } });
    assert.equal(denied.status, 403);

    const adminCookie = await register(base, "creator");
    const creator = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: "creator" } });
    await db.platformRoleAssignment.create({ data: { userId: creator.userId, role: "PLATFORM_ADMIN" } });
    const allowed = await fetch(`${base}/api/v1/admin/overview`, { headers: { cookie: adminCookie } });
    assert.equal(allowed.status, 200);
    const overview = await allowed.json() as { activePlatformAdmins: number };
    assert.equal(overview.activePlatformAdmins, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await resetDatabase();
  }
});
