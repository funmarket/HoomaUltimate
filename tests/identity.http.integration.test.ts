import assert from "node:assert/strict";
import test from "node:test";
import { sign } from "@tma.js/init-data-node";
import { loadApiConfig, type ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for identity integration tests");

const telegramBotToken = "integration-test-token";
const telegramInitData = sign(
  {
    user: {
      id: 279058397,
      first_name: "Vladislav",
      last_name: "Kibenko",
      username: "vdkfrost",
      language_code: "ru",
      is_premium: true,
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
});
const config: ApiConfig = { ...loadedConfig, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 0 };

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

async function registerWeb(base: string, loginUsername: string): Promise<string> {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername,
      password: "correct horse battery staple",
      displayUsername: loginUsername,
      displayName: loginUsername,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  return cookie;
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
    const anonymousSession = await fetch(`${base}/api/public/v1/auth/session`);
    assert.equal(anonymousSession.status, 200);
    assert.equal(await anonymousSession.json(), null);

    const cookie = await registerWeb(base, "founder");

    const optionalSession = await fetch(`${base}/api/public/v1/auth/session`, {
      headers: { cookie },
    });
    assert.equal(optionalSession.status, 200);
    const optionalSessionBody = (await optionalSession.json()) as {
      presentation: { username: string };
      transports: string[];
    };
    assert.equal(optionalSessionBody.presentation.username, "founder");
    assert.deepEqual(optionalSessionBody.transports, ["web"]);

    const me = await fetch(`${base}/api/v1/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    const body = (await me.json()) as {
      presentation: { username: string };
      transports: string[];
    };
    assert.equal(body.presentation.username, "founder");
    assert.deepEqual(body.transports, ["web"]);

    const logoutWithoutOrigin = await fetch(`${base}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(logoutWithoutOrigin.status, 403);

    const logout = await fetch(`${base}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie, origin: config.WEB_ORIGIN },
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(`${base}/api/v1/me`, { headers: { cookie } });
    assert.equal(afterLogout.status, 401);

    const optionalAfterLogout = await fetch(`${base}/api/public/v1/auth/session`, {
      headers: { cookie },
    });
    assert.equal(optionalAfterLogout.status, 200);
    assert.equal(await optionalAfterLogout.json(), null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});

test("Telegram public browsing does not create a HOOMA account before explicit activation", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const authorization = `tma ${telegramInitData}`;

  try {
    const optionalBrowseAccountCheck = await fetch(`${base}/api/public/v1/auth/session`, {
      headers: { authorization },
    });
    assert.equal(optionalBrowseAccountCheck.status, 200);
    assert.equal(await optionalBrowseAccountCheck.json(), null);

    const browseAccountCheck = await fetch(`${base}/api/v1/me`, {
      headers: { authorization },
    });
    assert.equal(browseAccountCheck.status, 401);
    assert.equal(await db.user.count(), 0);
    assert.equal(await db.userPresentation.count(), 0);
    assert.equal(await db.telegramIdentity.count(), 0);

    const activations = await Promise.all([
      fetch(`${base}/api/public/v1/auth/telegram/account`, {
        method: "POST",
        headers: { authorization, origin: config.TELEGRAM_ORIGIN },
      }),
      fetch(`${base}/api/public/v1/auth/telegram/account`, {
        method: "POST",
        headers: { authorization, origin: config.TELEGRAM_ORIGIN },
      }),
    ]);
    assert.deepEqual(
      activations.map((response) => response.status),
      [201, 201],
    );
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.userPresentation.count(), 1);
    assert.equal(await db.telegramIdentity.count(), 1);

    const me = await fetch(`${base}/api/v1/me`, { headers: { authorization } });
    assert.equal(me.status, 200);
    const body = (await me.json()) as {
      presentation: { username: string };
      transports: string[];
    };
    assert.equal(body.presentation.username, "vdkfrost");
    assert.deepEqual(body.transports, ["telegram"]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});

test("Telegram activation never silently splits an existing Web account", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await registerWeb(base, "web_owner");
    const authorization = `tma ${telegramInitData}`;
    const activation = await fetch(`${base}/api/public/v1/auth/telegram/account`, {
      method: "POST",
      headers: { authorization, cookie, origin: config.TELEGRAM_ORIGIN },
    });
    assert.equal(activation.status, 409);
    const body = (await activation.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ACCOUNT_LINK_REQUIRED");
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.userPresentation.count(), 1);
    assert.equal(await db.telegramIdentity.count(), 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
