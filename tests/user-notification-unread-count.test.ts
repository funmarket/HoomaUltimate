import assert from "node:assert/strict";
import test from "node:test";
import { UserNotificationService } from "../apps/api/src/modules/notifications/application/user-notification.service.js";
import type { UserNotificationRepository } from "../apps/api/src/modules/notifications/application/user-notification.repository.js";
import { PrismaUserNotificationRepository } from "../apps/api/src/modules/notifications/infrastructure/prisma-user-notification.repository.js";

type NotificationRow = {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: string;
  contextType: string;
  contextId: string;
  whistleId: string | null;
  sanctionId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
};

function row(overrides: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    recipientUserId: "user-1",
    actorUserId: "admin-1",
    type: "DIRECT_USER_WHISTLE",
    contextType: "USER_DIRECT",
    contextId: "user-1",
    whistleId: null,
    sanctionId: null,
    expiresAt: null,
    createdAt: new Date("2026-09-19T10:00:00.000Z"),
    readAt: null,
    ...overrides,
  };
}

/**
 * A recipient-honouring stand-in for the Prisma delegate: it applies the same `where` predicate
 * the repository builds, so the tests exercise the repository's own query construction instead of
 * a hand-rolled answer.
 */
// prettier-ignore
function recipientHonouringDb(rows: readonly NotificationRow[]) {
  function matches(candidate: NotificationRow, where: Record<string, unknown>) {
    if (where.recipientUserId !== undefined && candidate.recipientUserId !== where.recipientUserId) {
      return false;
    }
    if (where.readAt === null && candidate.readAt !== null) return false;
    const contextFilter = where.contextType as { in?: readonly string[] } | undefined;
    if (contextFilter?.in && !contextFilter.in.includes(candidate.contextType)) return false;
    return true;
  }
  return {
    userNotification: {
      findMany: async (args: { where: Record<string, unknown>; take?: number }) => {
        const filtered = rows.filter((candidate) => matches(candidate, args.where));
        return filtered.slice(0, args.take ?? filtered.length);
      },
      count: async (args: { where: Record<string, unknown> }) =>
        rows.filter((candidate) => matches(candidate, args.where)).length,
    },
  };
}

// prettier-ignore
test("the returned page stays bounded while the unread total is recipient-wide", async () => {
  const pageCalls: Array<{ recipientUserId: string; limit: number }> = [];
  const countCalls: string[] = [];
  const repository: UserNotificationRepository = {
    createWhistleNotification: async () => {
      throw new Error("not used");
    },
    createModerationNotification: async () => {
      throw new Error("not used");
    },
    listForRecipient: async (recipientUserId, limit) => {
      pageCalls.push({ recipientUserId, limit });
      return [
        row({ id: "n1", readAt: null }),
        row({ id: "n2", readAt: new Date("2026-09-18T10:00:00.000Z") }),
        row({ id: "n3", readAt: new Date("2026-09-18T11:00:00.000Z") }),
      ];
    },
    countUnreadForRecipient: async (recipientUserId) => {
      countCalls.push(recipientUserId);
      return 120;
    },
    markRead: async () => "marked_read",
  };
  const service = new UserNotificationService(repository);

  const response = await service.listForRecipient("user-1");

  // One unread entry in the page must not cap the total.
  assert.equal(response.items.length, 3);
  assert.equal(response.unreadCount, 120);
  assert.deepEqual(pageCalls, [{ recipientUserId: "user-1", limit: 50 }]);
  assert.deepEqual(countCalls, ["user-1"]);
});

// prettier-ignore
test("the repository counts unread rows across all applicable notifications, not the page", async () => {
  const rows: NotificationRow[] = [
    row({ id: "u1-a", readAt: null }),
    row({ id: "u1-b", readAt: null }),
    row({ id: "u1-read", readAt: new Date("2026-09-18T09:00:00.000Z") }),
    row({ id: "u1-ride", contextType: "RIDE", readAt: null }),
    row({ id: "u1-ride-read", contextType: "RIDE", readAt: new Date("2026-09-18T09:00:00.000Z") }),
    // Not a user-delivered notification context: excluded from both the page and the total.
    row({ id: "u1-team", contextType: "TEAM", readAt: null }),
    // Another recipient's unread rows must never influence the caller.
    row({ id: "u2-a", recipientUserId: "user-2", readAt: null }),
    row({ id: "u2-b", recipientUserId: "user-2", readAt: null }),
    row({ id: "u2-c", recipientUserId: "user-2", readAt: null }),
    row({ id: "u2-d", recipientUserId: "user-2", readAt: null }),
    row({ id: "u2-e", recipientUserId: "user-2", readAt: null }),
  ];
  const repository = new PrismaUserNotificationRepository(recipientHonouringDb(rows) as never);

  assert.equal(await repository.countUnreadForRecipient("user-1"), 3);
  assert.equal(await repository.countUnreadForRecipient("user-2"), 5);

  const page = await repository.listForRecipient("user-1", 2);
  assert.equal(page.length, 2);
  assert.equal(
    page.every((entry) => entry.recipientUserId === "user-1"),
    true,
  );
});

// prettier-ignore
test("a recipient with more unread notifications than the page size still gets a truthful total", async () => {
  const rows: NotificationRow[] = [];
  for (let index = 0; index < 60; index += 1) {
    rows.push(
      row({
        id: `bulk-${index}`,
        readAt: index < 55 ? null : new Date("2026-09-18T09:00:00.000Z"),
      }),
    );
  }
  const repository = new PrismaUserNotificationRepository(recipientHonouringDb(rows) as never);
  const service = new UserNotificationService(repository);

  const response = await service.listForRecipient("user-1");

  assert.equal(response.items.length, 50);
  assert.equal(response.unreadCount, 55);
  assert.ok(
    response.unreadCount > response.items.filter((item) => item.readAt === null).length,
  );
});
