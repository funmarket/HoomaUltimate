import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { TelegramIdentityInput } from "@hooma/auth";
import type { ApiConfig } from "@hooma/config";
import type {
  IdentityRepository,
  MeRecord,
  SessionRecord,
  WebCredentialRecord,
} from "../apps/api/src/modules/identity/application/identity.repository.js";
import { IdentityService } from "../apps/api/src/modules/identity/application/identity.service.js";

const config: ApiConfig = {
  NODE_ENV: "test",
  API_PORT: 3000,
  DATABASE_URL: "postgresql://test",
  REDIS_URL: undefined,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  SESSION_COOKIE_NAME: "hooma_session",
  SESSION_TTL_HOURS: 720,
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 86400,
};

class FakeIdentityRepository implements IdentityRepository {
  credential: WebCredentialRecord | null = null;
  sessions = new Map<string, string>();
  meRecord: MeRecord | null = {
    id: "user-1",
    presentation: {
      username: "fan",
      displayName: "Fan",
      photoUrl: null,
      bio: null,
    },
    platformRoles: [],
    communities: [],
    teams: [],
  };
  telegramUserId: string | null = null;
  telegramProvisionCount = 0;

  async createWebIdentity(input: { passwordHash: string }): Promise<string> {
    this.credential = {
      userId: "user-1",
      passwordHash: input.passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
    };
    return "user-1";
  }

  async findWebCredential(): Promise<WebCredentialRecord | null> {
    return this.credential;
  }

  async recordLoginFailure(
    userId: string,
    failedLoginCount: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    if (this.credential) {
      this.credential = { ...this.credential, userId, failedLoginCount, lockedUntil };
    }
  }

  async recordLoginSuccess(): Promise<void> {
    if (this.credential) {
      this.credential = { ...this.credential, failedLoginCount: 0, lockedUntil: null };
    }
  }

  async createSession(userId: string, tokenHash: string): Promise<void> {
    this.sessions.set(tokenHash, userId);
  }

  async findActiveSession(tokenHash: string): Promise<SessionRecord | null> {
    const userId = this.sessions.get(tokenHash);
    return userId ? { userId } : null;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async findTelegramUserId(): Promise<string | null> {
    return this.telegramUserId;
  }

  async upsertTelegramIdentity(_input: TelegramIdentityInput): Promise<string> {
    this.telegramProvisionCount += 1;
    this.telegramUserId = "telegram-user";
    return "telegram-user";
  }

  async updatePresentation(): Promise<void> {}

  async findMe(): Promise<MeRecord | null> {
    return this.meRecord;
  }
}

function telegramInitData(telegramUserId: number): string {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAE-test-query",
    user: JSON.stringify({
      id: telegramUserId,
      first_name: "Guest",
      username: `guest_${telegramUserId}`,
    }),
  };
  const checkString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(config.TELEGRAM_BOT_TOKEN!).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

test("web registration issues an opaque session and login verifies Argon2id hash", async () => {
  const repository = new FakeIdentityRepository();
  const service = new IdentityService(repository, config);
  const registration = await service.register({
    loginUsername: "Fan.Login",
    password: "correct horse battery staple",
    displayUsername: "Fan.Display",
    displayName: null,
    email: null,
  });
  assert.ok(registration.sessionToken.length >= 32);
  const login = await service.login({
    loginUsername: "fan.login",
    password: "correct horse battery staple",
  });
  assert.ok(login.sessionToken.length >= 32);
  assert.match(repository.credential?.passwordHash ?? "", /^\$argon2id\$/);
});

test("five failed web logins lock the credential", async () => {
  const repository = new FakeIdentityRepository();
  const service = new IdentityService(repository, config);
  await service.register({
    loginUsername: "coach",
    password: "correct horse battery staple",
    displayUsername: "coach",
    displayName: "Coach",
    email: null,
  });
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await assert.rejects(() => service.login({ loginUsername: "coach", password: "wrong" }));
  }
  assert.ok(repository.credential?.lockedUntil instanceof Date);
});

test("supplied invalid Telegram initData is classified invalid, never absent", async () => {
  const repository = new FakeIdentityRepository();
  const service = new IdentityService(repository, config);
  assert.deepEqual(await service.resolveTelegram("definitely-invalid"), { kind: "invalid" });
});

test("valid first-time Telegram visitor remains unregistered until explicit account provisioning", async () => {
  const repository = new FakeIdentityRepository();
  const service = new IdentityService(repository, config);
  const initData = telegramInitData(55112233);
  assert.deepEqual(await service.resolveTelegram(initData), { kind: "unregistered" });
  assert.equal(repository.telegramProvisionCount, 0);
  assert.deepEqual(await service.provisionTelegramAccount(initData), {
    userId: "telegram-user",
  });
  assert.equal(repository.telegramProvisionCount, 1);
  assert.deepEqual(await service.resolveTelegram(initData), {
    kind: "valid",
    userId: "telegram-user",
  });
});
