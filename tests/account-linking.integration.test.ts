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
const loadedConfig = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: telegramBotToken,
});
const config: ApiConfig = { ...loadedConfig, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 0 };
const db = getDatabaseClient();

function telegramInitData(id: number, username: string): string {
  return sign(
    {
      user: {
        id,
        first_name: "Linked",
        last_name: "Member",
        username,
        language_code: "en",
      },
    },
    telegramBotToken,
    new Date(),
  );
}

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

async function registerWeb(base: string, loginUsername: string): Promise<string> {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername,
      password: "correct horse battery staple",
      displayUsername: loginUsername,
      displayName: "Linked Web User",
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  return cookie;
}

async function userIdFor(base: string, headers: HeadersInit): Promise<string> {
  const response = await fetch(`${base}/api/v1/me`, { headers });
  assert.equal(response.status, 200);
  return ((await response.json()) as { id: string }).id;
}

test("Web and Telegram login methods attach to the same canonical User in both directions", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const firstTelegram = `tma ${telegramInitData(803441920, "telegram_first")}`;
    const activation = await fetch(`${base}/api/public/v1/auth/telegram/account`, {
      method: "POST",
      headers: { authorization: firstTelegram, origin: config.TELEGRAM_ORIGIN },
    });
    assert.equal(activation.status, 201);
    const telegramFirstUserId = await userIdFor(base, { authorization: firstTelegram });

    const addWeb = await fetch(`${base}/api/v1/auth/web-credential`, {
      method: "POST",
      headers: {
        authorization: firstTelegram,
        origin: config.TELEGRAM_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        loginUsername: "telegram_first_web",
        password: "correct horse battery staple",
        email: "telegram-first@example.com",
      }),
    });
    assert.equal(addWeb.status, 201);

    const webLogin = await fetch(`${base}/api/public/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: "telegram_first_web",
        password: "correct horse battery staple",
      }),
    });
    assert.equal(webLogin.status, 200);
    const webCookie = webLogin.headers.get("set-cookie");
    assert.ok(webCookie);
    assert.equal(await userIdFor(base, { cookie: webCookie }), telegramFirstUserId);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.telegramIdentity.count(), 1);
    assert.equal(await db.webCredential.count(), 1);

    await resetDatabase();

    const webFirstCookie = await registerWeb(base, "web_first");
    const webFirstUserId = await userIdFor(base, { cookie: webFirstCookie });
    const codeResponse = await fetch(`${base}/api/v1/auth/telegram-link/code`, {
      method: "POST",
      headers: { cookie: webFirstCookie, origin: config.WEB_ORIGIN },
    });
    assert.equal(codeResponse.status, 200);
    const link = (await codeResponse.json()) as {
      loginUsername: string;
      code: string;
      expiresAt: string;
    };
    assert.equal(link.loginUsername, "web_first");
    assert.equal(link.code.length, 16);
    assert.ok(new Date(link.expiresAt).getTime() > Date.now());

    const secondTelegram = `tma ${telegramInitData(803441921, "web_first_telegram")}`;
    const claim = await fetch(`${base}/api/public/v1/auth/telegram-link/claim`, {
      method: "POST",
      headers: {
        authorization: secondTelegram,
        origin: config.TELEGRAM_ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ loginUsername: link.loginUsername, code: link.code }),
    });
    assert.equal(claim.status, 200);
    assert.equal(await userIdFor(base, { authorization: secondTelegram }), webFirstUserId);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.userPresentation.count(), 1);
    assert.equal(await db.telegramIdentity.count(), 1);
    assert.equal(await db.webCredential.count(), 1);

    const methods = await fetch(`${base}/api/v1/me/login-methods`, {
      headers: { authorization: secondTelegram },
    });
    assert.equal(methods.status, 200);
    assert.deepEqual(await methods.json(), {
      web: { loginUsername: "web_first", email: null },
      telegram: { username: "web_first_telegram" },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
