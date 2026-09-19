import assert from "node:assert/strict";
import test from "node:test";
import { adminUserSearchQuerySchema } from "@hooma/contracts/platform-admin";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import {
  IdentityAdminService,
  type IdentityAdminRepository,
} from "../apps/api/src/modules/identity/application/identity-admin.service.js";
import { requireAuthentication } from "../apps/api/src/modules/identity/http/auth.middleware.js";
import { UserNotificationService } from "../apps/api/src/modules/notifications/application/user-notification.service.js";
import type { UserNotificationRepository } from "../apps/api/src/modules/notifications/application/user-notification.repository.js";
import type { PlatformAdminAuthorizer } from "../apps/api/src/modules/platform-admin/application/platform-admin.authorizer.js";

// prettier-ignore
function authorizer(): PlatformAdminAuthorizer {
  return {
    isPlatformAdmin: async () => false,
    can: async (_userId, capability) => capability === "MANAGE_USERS",
    requirePlatformAdmin: async () => {
      throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "owner required");
    },
    requireCapability: async (_userId, capability) => {
      if (capability !== "MANAGE_USERS") {
        throw new AppError(403, "APP_MANAGER_CAPABILITY_REQUIRED", "capability required");
      }
    },
  };
}

// prettier-ignore
const baseDetail = {
  userId: "user-1",
  presentation: { username: "member", displayName: "Member One", photoUrl: null },
  identity: { web: null, telegram: null },
  access: { isPlatformAdmin: false, managerCapabilities: [] },
  security: { activeSessionCount: 0, sessions: [] },
  moderation: {
    yellowCardCount: 2,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: false,
    readOnlyExpiresAt: null,
    isDisabled: false,
    activeSanctions: [],
    history: [],
  },
} as const;

// prettier-ignore
test("third strike is a red card one-week ban, not a third yellow card", async () => {
  const issued: Array<{ actionType: string; expiresAt: Date | null }> = [];
  const notified: string[] = [];
  const repository: IdentityAdminRepository = {
    searchAdminUsers: async () => [],
    findAdminUserDetail: async () => baseDetail as never,
    revokeActiveUserSessions: async () => 0,
    issueUserSanction: async (input) => {
      issued.push({ actionType: input.actionType, expiresAt: input.expiresAt });
    },
    clearUserSanction: async () => true,
  };
  const notifier = {
    notifyModerationSanction: async (input: { actionType: string }) => {
      notified.push(input.actionType);
    },
    notifyModerationClear: async () => undefined,
  };
  const service = new IdentityAdminService(repository, authorizer(), notifier);

  await service.sanctionUser("manager", "user-1", {
    actionType: "YELLOW_CARD_WARNING",
    reason: "third confirmed strike",
    expiresAt: null,
  });

  assert.deepEqual(
    issued.map((item) => item.actionType),
    ["RED_CARD_BAN"],
  );
  assert.equal(issued[0]?.expiresAt instanceof Date, true);
  assert.deepEqual(notified, ["RED_CARD_BAN"]);
});

// prettier-ignore
test("user listing supports a default recent-users view without a search query", () => {
  const parsed = adminUserSearchQuerySchema.safeParse({ limit: "25" });
  assert.equal(parsed.success, true);
});

// prettier-ignore
test("read-only enforcement also blocks admin write routes", async () => {
  const middleware = requireAuthentication(
    {
      resolveTelegram: async () => ({ kind: "absent" as const }),
      resolveWebSession: async () => "user-1",
      moderationStatus: async () => ({
        yellowCardCount: 1,
        isDisabled: false,
        isBanned: false,
        banExpiresAt: null,
        isReadOnly: true,
        readOnlyExpiresAt: "2026-09-26T10:00:00.000Z",
      }),
    } as never,
    {
      SESSION_COOKIE_NAME: "sid",
      WEB_ORIGIN: "http://localhost",
      TELEGRAM_ORIGIN: "https://t.me",
    } as never,
  );
  let error: unknown = null;
  await middleware(
    {
      method: "POST",
      path: "/admin/users/user-1/sanctions",
      header: (name: string) =>
        name.toLowerCase() === "origin" ? "http://localhost" : undefined,
      headers: { cookie: "sid=session-token" },
    } as never,
    {} as never,
    (nextError?: unknown) => {
      error = nextError ?? null;
    },
  );
  assert.equal((error as { code?: string } | null)?.code, "ACCOUNT_READ_ONLY");
});

// prettier-ignore
test("notification service persists moderation notices and supports read state", async () => {
  const created: unknown[] = [];
  const marked: string[] = [];
  const repository: UserNotificationRepository = {
    createWhistleNotification: async () => {
      throw new Error("not used");
    },
    createModerationNotification: async (input: unknown) => {
      created.push(input);
      return {
        id: "notification-1",
        recipientUserId: "user-1",
        actorUserId: "admin-1",
        type: "MODERATION_YELLOW_CARD",
        contextType: "USER_DIRECT",
        contextId: "user-1",
        whistleId: null,
        sanctionId: "sanction-1",
        strikeNumber: 1,
        expiresAt: null,
        createdAt: new Date("2026-09-19T10:00:00.000Z"),
        readAt: null,
      };
    },
    listForRecipient: async () => [],
    markRead: async (_recipientUserId: string, notificationId: string) => {
      marked.push(notificationId);
      return true;
    },
  };
  const service = new UserNotificationService(repository);

  await service.notifyModerationSanction({
    recipientUserId: "user-1",
    actorUserId: "admin-1",
    sanctionId: "sanction-1",
    actionType: "YELLOW_CARD_WARNING",
    strikeNumber: 1,
    expiresAt: null,
    createdAt: new Date("2026-09-19T10:00:00.000Z"),
  });
  await service.markRead("user-1", "notification-1");

  assert.equal(created.length, 1);
  assert.deepEqual(marked, ["notification-1"]);
});
