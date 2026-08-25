import assert from "node:assert/strict";
import test from "node:test";
import { sign } from "@tma.js/init-data-node";
import { loadApiConfig, type ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for account linking integration tests");

const telegramBotToken = "account-linking-integration-token";
const telegramInitData = sign(
  {
    user: {
      id: 803441920,
      first_name: "Linked",
      last_name: "Member",
      username: "linked_member",
      language_code: "en",
    },
  },
  telegramBotToken,
  new Date(),
);

const loadedConfig = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: telegramBotToken,
  TELEGRAM_LOGIN_CLIENT_ID: "",
  TELEGRAM_LOGIN_CLIENT_SECRET: "",
  TELEGRAM_LOGIN_REDIRECT_URI: "",
});
const config: ApiConfig = { ...loadedConfig, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 0 };
const db = getDatabaseClient();

async function resetDatabase() {
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.playerProfile.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

test("Telegram account can optionally add Web credentials and both resolve to one User", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const telegramAuthorization = `tma ${telegramInitData}`;

  try {
    const activation = await fetch(`${base}/api/public/v1/auth/telegram/account`, {
      method: "POST",
      headers: { authorization: telegramAuthorization, origin: config.TELEGRAM_ORIGIN },
    });
    assert.equal(activation.status, 201);

    const telegramMe = await fetch(`${base}/api/v1/me`, {
      headers: { authorization: telegramAuthorization },
    });
    assert.equal(telegramMe.status, 200);
    const telegramMeBody = (await telegramMe.json()) as { id: string; transports: string[] };
    assert.deepEqual(telegramMeBody.transports, ["telegram"]);

    const before = await fetch(`${base}/api/v1/me/login-methods`, {
      headers: { authorization: telegramAuthorization },
    });
    assert.equal(before.status, 200);
    assert.deepEqual(await before.json(), {
      web: null,
      telegram: { username: "linked_member" },
    });

    const attachWeb = await fetch(`${base}/api/v1/auth/web-credential`, {
      method: "POST",
      headers: {
        authorization: telegramAuthorization,
        origin: config.TELEGRAM_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginUsername: "linked_web",
        password: "correct horse battery staple",
        email: "linked@example.com",
      }),
    });
    assert.equal(attachWeb.status, 201);
    assert.deepEqual(await attachWeb.json(), {
      web: { loginUsername: "linked_web", email: "linked@example.com" },
      telegram: { username: "linked_member" },
    });

    assert.equal(await db.user.count(), 1);
    assert.equal(await db.userPresentation.count(), 1);
    assert.equal(await db.telegramIdentity.count(), 1);
    assert.equal(await db.webCredential.count(), 1);
    const storedWeb = await db.webCredential.findUnique({ where: { loginUsername: "linked_web" } });
    const storedTelegram = await db.telegramIdentity.findUnique({
      where: { telegramUserId: BigInt(803441920) },
    });
    assert.equal(storedWeb?.userId, telegramMeBody.id);
    assert.equal(storedTelegram?.userId, telegramMeBody.id);

    const webLogin = await fetch(`${base}/api/public/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: "linked_web",
        password: "correct horse battery staple",
      }),
    });
    assert.equal(webLogin.status, 200);
    const webCookie = webLogin.headers.get("set-cookie");
    assert.ok(webCookie?.includes(`${config.SESSION_COOKIE_NAME}=`));

    const webMe = await fetch(`${base}/api/v1/me`, { headers: { cookie: webCookie } });
    assert.equal(webMe.status, 200);
    const webMeBody = (await webMe.json()) as { id: string; transports: string[] };
    assert.equal(webMeBody.id, telegramMeBody.id);
    assert.deepEqual(webMeBody.transports, ["web"]);

    const duplicateAttach = await fetch(`${base}/api/v1/auth/web-credential`, {
      method: "POST",
      headers: {
        authorization: telegramAuthorization,
        origin: config.TELEGRAM_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginUsername: "another_login",
        password: "correct horse battery staple",
        email: null,
      }),
    });
    assert.equal(duplicateAttach.status, 409);
    const duplicateBody = (await duplicateAttach.json()) as { error: { code: string } };
    assert.equal(duplicateBody.error.code, "WEB_CREDENTIAL_EXISTS");
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.webCredential.count(), 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
