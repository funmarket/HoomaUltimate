import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig, type ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
import type {
  PasswordRecoveryDelivery,
} from "../apps/api/src/modules/identity/application/password-recovery-delivery.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for recovery integration tests");

const loadedConfig = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const config: ApiConfig = loadedConfig;
const db = getDatabaseClient();

class CapturingPasswordRecoveryDelivery implements PasswordRecoveryDelivery {
  readonly deliveries: {
    telegramUserId: bigint;
    loginUsername: string;
    code: string;
    expiresAt: Date;
  }[] = [];
  private deliveryGate: Promise<void> | null = null;
  private releaseDeliveryGate: (() => void) | null = null;

  blockNextDelivery(): () => void {
    this.deliveryGate = new Promise<void>((resolve) => {
      this.releaseDeliveryGate = resolve;
    });
    return () => {
      this.releaseDeliveryGate?.();
      this.releaseDeliveryGate = null;
    };
  }

  async sendTelegramRecoveryCode(input: {
    readonly telegramUserId: bigint;
    readonly loginUsername: string;
    readonly code: string;
    readonly expiresAt: Date;
  }): Promise<void> {
    this.deliveries.push({ ...input });
    const gate = this.deliveryGate;
    this.deliveryGate = null;
    if (gate) await gate;
  }
}

async function cleanupTestAccounts() {
  const rows = await db.webCredential.findMany({
    where: { loginUsername: { in: ["recovery_cryptotemplar", "recovery_unlinked"] } },
    select: { userId: true },
  });
  const telegram = await db.telegramIdentity.findUnique({
    where: { telegramUserId: 99112233n },
    select: { userId: true },
  });
  const userIds = [
    ...new Set([...rows.map((row) => row.userId), ...(telegram ? [telegram.userId] : [])]),
  ];
  if (userIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
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

test(
  "linked Telegram recovery resets the Web password, revokes sessions, and consumes the code",
  async () => {
    await cleanupTestAccounts();
    const delivery = new CapturingPasswordRecoveryDelivery();
    const app = createApp(config, createContainer(config, { passwordRecoveryDelivery: delivery }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;

    try {
      const oldPassword = "correct horse battery staple";
      const newPassword = "new correct horse battery staple";
      await registerWeb(base, "recovery_cryptotemplar", oldPassword);
      const credential = await db.webCredential.findUniqueOrThrow({
        where: { loginUsername: "recovery_cryptotemplar" },
        select: { userId: true },
      });
      await db.telegramIdentity.create({
        data: {
          userId: credential.userId,
          telegramUserId: 99112233n,
          telegramUsername: "CryptoTemplar",
        },
      });

      const releaseDelivery = delivery.blockNextDelivery();
      const requestPromise = fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({ loginUsername: "Recovery_CryptoTemplar" }),
      });
      let request: Response;
      try {
        request = await Promise.race([
          requestPromise,
          new Promise<never>((_resolve, reject) => {
            setTimeout(
              () => reject(new Error("Recovery request waited for Telegram delivery")),
              2_000,
            );
          }),
        ]);
      } finally {
        releaseDelivery();
      }
      assert.equal(request.status, 202);
      assert.deepEqual(await request.json(), { ok: true });
      assert.equal(delivery.deliveries.length, 1);
      assert.equal(delivery.deliveries[0]?.telegramUserId, 99112233n);
      assert.equal(delivery.deliveries[0]?.loginUsername, "recovery_cryptotemplar");
      assert.match(delivery.deliveries[0]?.code ?? "", /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

      const challengeBefore = await db.passwordRecoveryChallenge.findFirstOrThrow({
        where: { userId: credential.userId, consumedAt: null },
        orderBy: { createdAt: "desc" },
        select: { codeHash: true },
      });
      assert.notEqual(challengeBefore.codeHash, delivery.deliveries[0]?.code);
      assert.match(challengeBefore.codeHash, /^\$argon2id\$/);

      const wrongCode = await fetch(`${base}/api/public/v1/auth/password-recovery/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({
          loginUsername: "recovery_cryptotemplar",
          code: "AAAAA-AAAAA",
          newPassword,
        }),
      });
      assert.equal(wrongCode.status, 400);
      const afterWrongCode = await db.passwordRecoveryChallenge.findFirstOrThrow({
        where: { userId: credential.userId, consumedAt: null },
        orderBy: { createdAt: "desc" },
        select: { failedAttempts: true },
      });
      assert.equal(afterWrongCode.failedAttempts, 1);

      const reset = await fetch(`${base}/api/public/v1/auth/password-recovery/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({
          loginUsername: "recovery_cryptotemplar",
          code: delivery.deliveries[0]?.code,
          newPassword,
        }),
      });
      assert.equal(reset.status, 200);
      assert.deepEqual(await reset.json(), { ok: true });

      const credentialAfter = await db.webCredential.findUniqueOrThrow({
        where: { loginUsername: "recovery_cryptotemplar" },
        select: { failedLoginCount: true, lockedUntil: true },
      });
      assert.equal(credentialAfter.failedLoginCount, 0);
      assert.equal(credentialAfter.lockedUntil, null);

      const sessions = await db.webSession.findMany({
        where: { userId: credential.userId },
        select: { revokedAt: true },
      });
      assert.ok(sessions.length >= 1);
      assert.ok(sessions.every((session) => session.revokedAt instanceof Date));

      const consumed = await db.passwordRecoveryChallenge.findFirstOrThrow({
        where: { userId: credential.userId },
        orderBy: { createdAt: "desc" },
        select: { consumedAt: true },
      });
      assert.ok(consumed.consumedAt instanceof Date);

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

      const reuse = await fetch(`${base}/api/public/v1/auth/password-recovery/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({
          loginUsername: "recovery_cryptotemplar",
          code: delivery.deliveries[0]?.code,
          newPassword: "another secure password",
        }),
      });
      assert.equal(reuse.status, 400);

      await registerWeb(base, "recovery_unlinked", "another correct horse battery staple");
      const unlinked = await fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({ loginUsername: "recovery_unlinked" }),
      });
      assert.equal(unlinked.status, 202);
      assert.deepEqual(await unlinked.json(), { ok: true });
      assert.equal(delivery.deliveries.length, 1);

      const unknown = await fetch(`${base}/api/public/v1/auth/password-recovery/request`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
        body: JSON.stringify({ loginUsername: "does.not.exist" }),
      });
      assert.equal(unknown.status, 202);
      assert.deepEqual(await unknown.json(), { ok: true });
      assert.equal(delivery.deliveries.length, 1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await cleanupTestAccounts();
    }
  },
);
