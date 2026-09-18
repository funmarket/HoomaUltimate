import assert from "node:assert/strict";
import test from "node:test";
import { requireAuthentication } from "../apps/api/src/modules/identity/http/auth.middleware.js";

const config = {
  SESSION_COOKIE_NAME: "sid",
  WEB_ORIGIN: "http://localhost",
  TELEGRAM_ORIGIN: "https://t.me",
} as const;

type Moderation = {
  readonly isDisabled: boolean;
  readonly isBanned: boolean;
  readonly banExpiresAt: string | null;
  readonly isReadOnly: boolean;
  readonly readOnlyExpiresAt: string | null;
};

function createService(moderation: Moderation) {
  return {
    resolveTelegram: async () => ({ kind: "absent" as const }),
    resolveWebSession: async () => "user-1",
    moderationStatus: async () => ({
      yellowCardCount: 0,
      ...moderation,
    }),
  };
}

function createRequest(method: string, path: string) {
  return {
    method,
    path,
    header: (name: string) => (name.toLowerCase() === "origin" ? "http://localhost" : undefined),
    headers: { cookie: "sid=session-token" },
  };
}

async function runMiddleware(moderation: Moderation, method: string, path = "/places") {
  const middleware = requireAuthentication(createService(moderation) as never, config as never);
  let error: unknown = null;
  await middleware(createRequest(method, path) as never, {} as never, (nextError?: unknown) => {
    error = nextError ?? null;
  });
  return error;
}

test("active temporary ban blocks authenticated access with user-facing status", async () => {
  const error = await runMiddleware(
    {
      isDisabled: false,
      isBanned: true,
      banExpiresAt: "2026-09-25T10:00:00.000Z",
      isReadOnly: false,
      readOnlyExpiresAt: null,
    },
    "GET",
  );

  assert.equal((error as { code?: string }).code, "ACCOUNT_BANNED");
  assert.match((error as Error).message, /banned until 2026-09-25T10:00:00.000Z/);
});

test("read-only users may read but cannot mutate outside admin routes", async () => {
  const moderation = {
    isDisabled: false,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: true,
    readOnlyExpiresAt: "2026-09-20T10:00:00.000Z",
  };

  assert.equal(await runMiddleware(moderation, "GET"), null);
  const blocked = await runMiddleware(moderation, "POST", "/teams");
  assert.equal((blocked as { code?: string }).code, "ACCOUNT_READ_ONLY");
});

test("disabled accounts are blocked before member mutations", async () => {
  const error = await runMiddleware(
    {
      isDisabled: true,
      isBanned: false,
      banExpiresAt: null,
      isReadOnly: false,
      readOnlyExpiresAt: null,
    },
    "POST",
  );

  assert.equal((error as { code?: string }).code, "ACCOUNT_DISABLED");
});
