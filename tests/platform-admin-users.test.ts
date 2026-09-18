import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import {
  IdentityAdminService,
  type IdentityAdminRepository,
} from "../apps/api/src/modules/identity/application/identity-admin.service.js";
import type { PlatformAdminAuthorizer } from "../apps/api/src/modules/platform-admin/application/platform-admin.authorizer.js";

const safeUserDetail = {
  userId: "user-1",
  presentation: {
    username: "userone",
    displayName: "User One",
    photoUrl: null,
  },
  identity: {
    web: {
      loginUsername: "userone",
      email: "user@example.com",
      lastLoginAt: "2026-09-16T10:00:00.000Z",
    },
    telegram: {
      telegramUserId: "123456789",
      telegramUsername: "userone_tg",
      lastAuthenticatedAt: "2026-09-16T09:30:00.000Z",
    },
  },
  access: {
    isPlatformAdmin: false,
    managerCapabilities: [],
  },
  security: {
    activeSessionCount: 1,
    sessions: [
      {
        id: "session-1",
        createdAt: "2026-09-16T09:00:00.000Z",
        lastSeenAt: "2026-09-16T10:05:00.000Z",
        expiresAt: "2026-09-23T09:00:00.000Z",
        revokedAt: null,
        isActive: true,
      },
    ],
  },
  moderation: {
    yellowCardCount: 0,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: false,
    readOnlyExpiresAt: null,
    isDisabled: false,
    activeSanctions: [],
    history: [],
  },
};

function createAuthorizer(): PlatformAdminAuthorizer {
  return {
    isPlatformAdmin: async (userId) => userId === "platform-admin",
    can: async (userId, capability) =>
      userId === "platform-admin" || (userId === "user-manager" && capability === "MANAGE_USERS"),
    requirePlatformAdmin: async (userId) => {
      if (userId !== "platform-admin") {
        throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "App owner access required");
      }
    },
    requireCapability: async (userId, capability) => {
      if (
        userId !== "platform-admin" &&
        !(userId === "user-manager" && capability === "MANAGE_USERS")
      ) {
        throw new AppError(403, "APP_MANAGER_CAPABILITY_REQUIRED", `${capability} access required`);
      }
    },
  };
}

function createRepository(overrides: Partial<IdentityAdminRepository> = {}) {
  const calls: string[] = [];
  const repository: IdentityAdminRepository = {
    searchAdminUsers: async (query, limit) => {
      calls.push(`search:${query}:${limit}`);
      return [
        {
          userId: safeUserDetail.userId,
          username: safeUserDetail.presentation.username,
          displayName: safeUserDetail.presentation.displayName,
          photoUrl: safeUserDetail.presentation.photoUrl,
          telegramUsername: safeUserDetail.identity.telegram.telegramUsername,
          hasWebCredential: true,
          lastLoginAt: safeUserDetail.identity.web.lastLoginAt,
          activeSessionCount: 1,
          isPlatformAdmin: false,
          managerCapabilities: ["MANAGE_ADMIN_ISSUES"],
        },
      ];
    },
    findAdminUserDetail: async (targetUserId) => {
      calls.push(`detail:${targetUserId}`);
      if (targetUserId === "platform-admin") {
        return {
          ...safeUserDetail,
          userId: "platform-admin",
          access: { isPlatformAdmin: true, managerCapabilities: [] },
        };
      }
      if (targetUserId === "admin-issues-manager") {
        return {
          ...safeUserDetail,
          userId: "admin-issues-manager",
          access: { isPlatformAdmin: false, managerCapabilities: ["MANAGE_ADMIN_ISSUES"] },
        };
      }
      return safeUserDetail;
    },
    revokeActiveUserSessions: async (actorUserId, targetUserId, reason) => {
      calls.push(`revoke:${actorUserId}:${targetUserId}:${reason}`);
      return 1;
    },
    issueUserSanction: async (input) => {
      calls.push(
        `sanction:${input.actorUserId}:${input.targetUserId}:${input.actionType}:${input.reason}:${input.expiresAt?.toISOString() ?? "none"}`,
      );
    },
    clearUserSanction: async (input) => {
      calls.push(
        `clear:${input.actorUserId}:${input.targetUserId}:${input.sanctionId}:${input.reason}`,
      );
      return input.sanctionId !== "missing";
    },
    ...overrides,
  };
  return { repository, calls };
}

async function rejectsWithCode(task: () => Promise<unknown>, code: string) {
  await assert.rejects(task, (reason) => {
    return Boolean(
      reason && typeof reason === "object" && "code" in reason && reason.code === code,
    );
  });
}

test("MANAGE_USERS can search and read safe user security details without credential exposure", async () => {
  const { repository, calls } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());

  const users = await service.searchUsers("user-manager", "userone", 25);
  const detail = await service.userDetail("user-manager", "user-1");

  assert.equal(users[0]?.userId, "user-1");
  assert.equal(detail.security.activeSessionCount, 1);
  assert.equal(detail.identity.web?.lastLoginAt, "2026-09-16T10:00:00.000Z");
  assert.deepEqual(calls, ["search:userone:25", "detail:user-1"]);
  const serialized = JSON.stringify({ users, detail });
  assert.equal(serialized.includes("passwordHash"), false);
  assert.equal(serialized.includes("tokenHash"), false);
  assert.equal(serialized.includes("sessionToken"), false);
  assert.equal(serialized.includes("cookie"), false);
});

test("VIEW_AUDIT cannot read or mutate user security administration", async () => {
  const { repository, calls } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());

  await rejectsWithCode(
    () => service.searchUsers("audit-manager", "userone", 25),
    "APP_MANAGER_CAPABILITY_REQUIRED",
  );
  await rejectsWithCode(
    () => service.userDetail("audit-manager", "user-1"),
    "APP_MANAGER_CAPABILITY_REQUIRED",
  );
  await rejectsWithCode(
    () => service.revokeUserSessions("audit-manager", "user-1", "compromised account"),
    "APP_MANAGER_CAPABILITY_REQUIRED",
  );
  assert.deepEqual(calls, []);
});

test("user session revocation is Identity-owned, reason-required, audited, and idempotent", async () => {
  const { repository, calls } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());

  await rejectsWithCode(
    () => service.revokeUserSessions("user-manager", "user-1", "   "),
    "USER_SESSION_REVOCATION_REASON_REQUIRED",
  );
  assert.deepEqual(
    await service.revokeUserSessions("user-manager", "user-1", " confirmed takeover "),
    {
      ok: true,
      revokedSessionCount: 1,
    },
  );
  assert.deepEqual(calls, [
    "detail:user-1",
    "detail:user-1",
    "revoke:user-manager:user-1:confirmed takeover",
  ]);
});

test("delegated user managers cannot revoke Platform Admin or App Manager sessions", async () => {
  const { repository, calls } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());

  await rejectsWithCode(
    () => service.revokeUserSessions("user-manager", "platform-admin", "admin review"),
    "USER_SESSION_REVOCATION_TARGET_FORBIDDEN",
  );
  await rejectsWithCode(
    () => service.revokeUserSessions("user-manager", "admin-issues-manager", "admin review"),
    "USER_SESSION_REVOCATION_TARGET_FORBIDDEN",
  );
  assert.deepEqual(
    await service.revokeUserSessions("platform-admin", "admin-issues-manager", "owner review"),
    {
      ok: true,
      revokedSessionCount: 1,
    },
  );
  assert.deepEqual(calls, [
    "detail:platform-admin",
    "detail:admin-issues-manager",
    "detail:admin-issues-manager",
    "revoke:platform-admin:admin-issues-manager:owner review",
  ]);
});

test("yellow cards require a reason and third strike escalates to red card one-week ban", async () => {
  let yellowCount = 2;
  const { repository, calls } = createRepository({
    findAdminUserDetail: async (targetUserId) => {
      calls.push(`detail:${targetUserId}`);
      return {
        ...safeUserDetail,
        moderation: {
          ...safeUserDetail.moderation,
          yellowCardCount: yellowCount,
        },
      };
    },
    issueUserSanction: async (input) => {
      calls.push(`sanction:${input.actionType}:${input.reason}:${Boolean(input.expiresAt)}`);
      if (input.actionType === "YELLOW_CARD_WARNING") yellowCount += 1;
    },
  });
  const service = new IdentityAdminService(repository, createAuthorizer());

  await rejectsWithCode(
    () =>
      service.sanctionUser("user-manager", "user-1", {
        actionType: "YELLOW_CARD_WARNING",
        reason: " ",
        expiresAt: null,
      }),
    "USER_SANCTION_REASON_REQUIRED",
  );
  await service.sanctionUser("user-manager", "user-1", {
    actionType: "YELLOW_CARD_WARNING",
    reason: "abuse report confirmed",
    expiresAt: null,
  });

  assert.ok(calls.includes("sanction:YELLOW_CARD_WARNING:abuse report confirmed:false"));
  assert.ok(
    calls.includes("sanction:RED_CARD_BAN:Automatic red card after third yellow card warning:true"),
  );
});

test("temporary ban and read-only controls require future expiration and can be cleared", async () => {
  const { repository, calls } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await rejectsWithCode(
    () =>
      service.sanctionUser("user-manager", "user-1", {
        actionType: "TEMPORARY_BAN",
        reason: "spam",
        expiresAt: null,
      }),
    "USER_SANCTION_DURATION_REQUIRED",
  );

  await service.sanctionUser("user-manager", "user-1", {
    actionType: "TEMPORARY_BAN",
    reason: "spam",
    expiresAt: future,
  });
  await service.sanctionUser("user-manager", "user-1", {
    actionType: "READ_ONLY",
    reason: "cooldown",
    expiresAt: future,
  });
  await service.clearUserSanction("user-manager", "user-1", "sanction-1", {
    reason: "appeal accepted",
  });

  assert.ok(
    calls.some((call) => call.startsWith("sanction:user-manager:user-1:TEMPORARY_BAN:spam:")),
  );
  assert.ok(
    calls.some((call) => call.startsWith("sanction:user-manager:user-1:READ_ONLY:cooldown:")),
  );
  assert.ok(calls.includes("clear:user-manager:user-1:sanction-1:appeal accepted"));
});

test("delegated managers cannot sanction Platform Admin or App Manager users", async () => {
  const { repository } = createRepository();
  const service = new IdentityAdminService(repository, createAuthorizer());

  await rejectsWithCode(
    () =>
      service.sanctionUser("user-manager", "platform-admin", {
        actionType: "ACCOUNT_DISABLED",
        reason: "unsafe target",
        expiresAt: null,
      }),
    "USER_SANCTION_TARGET_FORBIDDEN",
  );
  await rejectsWithCode(
    () =>
      service.sanctionUser("user-manager", "admin-issues-manager", {
        actionType: "READ_ONLY",
        reason: "unsafe target",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    "USER_SANCTION_TARGET_FORBIDDEN",
  );
});
