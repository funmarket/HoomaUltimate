import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for identity integration tests");

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

test("register -> cookie session -> me -> protected logout works against PostgreSQL", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const registration = await fetch(`${base}/api/public/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: "founder",
        password: "correct horse battery staple",
        displayUsername: "founder",
        displayName: "Founder"
      })
    });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get("set-cookie");
    assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));

    const me = await fetch(`${base}/api/v1/me`, { headers: { cookie: cookie! } });
    assert.equal(me.status, 200);
    const body = await me.json() as { presentation: { username: string }; transports: string[] };
    assert.equal(body.presentation.username, "founder");
    assert.deepEqual(body.transports, ["web"]);

    const logoutWithoutOrigin = await fetch(`${base}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie: cookie! }
    });
    assert.equal(logoutWithoutOrigin.status, 403);

    const logout = await fetch(`${base}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie: cookie!, origin: config.WEB_ORIGIN }
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(`${base}/api/v1/me`, { headers: { cookie: cookie! } });
    assert.equal(afterLogout.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await resetDatabase();
  }
});
