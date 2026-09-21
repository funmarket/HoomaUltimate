import assert from "node:assert/strict";
import test from "node:test";
import { sign } from "@tma.js/init-data-node";
import { loadApiConfig, type ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for recovery integration tests");

const telegramBotToken = "integration-test-token";
const telegramUserId = 99112233;
const telegramInitData = sign(
  {
    user: {
      id: telegramUserId,
      first_name: "Crypto",
      last_name: "Templar",
      username: "CryptoTemplar",
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
});
const config: ApiConfig = { ...loadedConfig, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 0 };
const db = getDatabaseClient();

async function cleanupTestAccounts() {
  const rows = await db.webCredential.findMany({
    where: { loginUsername: { in: ["recovery_cryptotemplar", "recovery_unlinked"] } },
    select: { userId: true },
  });
  const telegram = await db.telegramIdentity.findUnique({
    where: { telegramUserId: BigInt(telegramUserId) },
    select: { userId: true },
  });
  const userIds = [
    ...new Set([...rows.map((row) => row.userId), ...(telegram ? [telegram.userId] : [])]),
  ];
  if (userIds.length > 0) await db.user.deleteMany({ where: { id: { in: userIds } } });
}

async function registerWeb(base: string, loginUsername: string, password: string): Promise<string> {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername,
      password,
      displayUsername: loginUsername,
      displayName: loginUsername,
      email: null,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  return cookie;
}

test("linked Telegram recovery uses HOOMA notifications and resets the Web password", async () => {
  await cleanupTestAccounts();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const oldPassword = "correct horse battery staple";
    const newPassword = "new correct horse battery staple";
    const webCookie = await registerWeb(base, "recovery_cryptotemplar", oldPassword);
    const credential = await db.webCredential.findUniqueOrThrow({
      where: { loginUsername: "recovery_cryptotemplar" },
      select: { userId: true },
    });
    await db.telegramIdentity.create({
      data: {
        userId: credential.userId,
        telegramUserId: BigInt(telegramUserId),
        telegramUsername: "CryptoTemplar",
      },
    });

    const request = await fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ loginUsername: "Recovery_CryptoTemplar" }),
    });
    assert.equal(request.status, 202);

    const notification = await db.userNotification.findFirstOrThrow({
      where: { recipientUserId: credential.userId, type: "PASSWORD_RECOVERY" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(notification.actorUserId, null);
    assert.equal(notification.readAt, null);
    assert.equal(
      await db.passwordRecoveryChallenge.count({
        where: { userId: credential.userId, consumedAt: null },
      }),
      0,
    );

    const webReveal = await fetch(
      `${base}/api/v1/auth/password-recovery/notifications/${notification.id}/code`,
      { method: "POST", headers: { cookie: webCookie, origin: config.WEB_ORIGIN } },
    );
    assert.equal(webReveal.status, 403);

    const pageResponse = await fetch(`${base}/api/v1/notifications`, {
      headers: { authorization: `tma ${telegramInitData}` },
    });
    assert.equal(pageResponse.status, 200);
    const page = (await pageResponse.json()) as {
      unreadCount: number;
      items: Array<{ type: string; actorUserId: string | null }>;
    };
    assert.equal(page.unreadCount, 1);
    assert.equal(page.items[0]?.type, "PASSWORD_RECOVERY");
    assert.equal(page.items[0]?.actorUserId, null);

    const reveal = await fetch(
      `${base}/api/v1/auth/password-recovery/notifications/${notification.id}/code`,
      {
        method: "POST",
        headers: {
          authorization: `tma ${telegramInitData}`,
          origin: config.TELEGRAM_ORIGIN,
        },
      },
    );
    assert.equal(reveal.status, 200);
    const recovery = (await reveal.json()) as {
      loginUsername: string;
      code: string;
      expiresAt: string;
    };
    assert.equal(recovery.loginUsername, "recovery_cryptotemplar");
    assert.match(recovery.code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const challenge = await db.passwordRecoveryChallenge.findFirstOrThrow({
      where: { userId: credential.userId, consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { codeHash: true },
    });
    assert.notEqual(challenge.codeHash, recovery.code);
    assert.match(challenge.codeHash, /^\$argon2id\$/);

    const reset = await fetch(`${base}/api/public/v1/auth/password-recovery/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: "recovery_cryptotemplar",
        code: recovery.code,
        newPassword,
      }),
    });
    assert.equal(reset.status, 200);

    const oldLogin = await fetch(`${base}/api/public/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ loginUsername: "recovery_cryptotemplar", password: oldPassword }),
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await fetch(`${base}/api/public/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ loginUsername: "recovery_cryptotemplar", password: newPassword }),
    });
    assert.equal(newLogin.status, 200);

    await registerWeb(base, "recovery_unlinked", "another correct horse battery staple");
    const unlinked = await fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ loginUsername: "recovery_unlinked" }),
    });
    assert.equal(unlinked.status, 202);

    const unknown = await fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ loginUsername: "does.not.exist" }),
    });
    assert.equal(unknown.status, 202);
    assert.equal(
      await db.userNotification.count({ where: { type: "PASSWORD_RECOVERY" } }),
      1,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await cleanupTestAccounts();
  }
});
