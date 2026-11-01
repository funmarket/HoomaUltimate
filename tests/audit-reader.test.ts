import assert from "node:assert/strict";
import test from "node:test";
import { PrismaAuditReader } from "../apps/api/src/modules/audit/infrastructure/prisma-audit-reader.js";

test("Audit reader returns metadata-free cursor pages with canonical filters", async () => {
  let findManyArgs: unknown;
  const rows = [
    {
      id: "audit-new",
      actorUserId: "user-1",
      action: "USER_SESSION_REVOKED",
      entityType: "User",
      entityId: "target-1",
      createdAt: new Date("2026-09-18T10:00:00.000Z"),
      metadata: { token: "secret-token" },
    },
    {
      id: "audit-old",
      actorUserId: "user-1",
      action: "USER_SESSION_REVOKED",
      entityType: "User",
      entityId: "target-2",
      createdAt: new Date("2026-09-18T09:00:00.000Z"),
      metadata: { token: "secret-token-2" },
    },
  ];
  const db = {
    auditLog: {
      count: async () => 7,
      findMany: async (args: unknown) => {
        findManyArgs = args;
        return rows;
      },
      findFirst: async () => null,
    },
  };
  const reader = new PrismaAuditReader(
    db as unknown as ConstructorParameters<typeof PrismaAuditReader>[0],
  );

  assert.equal(await reader.count(), 7);
  const page = await reader.findPage({
    actorUserId: "user-1",
    action: "USER_SESSION_REVOKED",
    entityType: "User",
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.999Z"),
    limit: 1,
    cursor: null,
  });

  assert.deepEqual(page.items, [rows[0] && {
    id: rows[0].id,
    actorUserId: rows[0].actorUserId,
    action: rows[0].action,
    entityType: rows[0].entityType,
    entityId: rows[0].entityId,
    createdAt: rows[0].createdAt,
  }]);
  assert.equal(JSON.stringify(page).includes("secret-token"), false);
  assert.deepEqual(page.nextCursor, {
    createdAt: rows[0]!.createdAt,
    id: rows[0]!.id,
  });
  assert.deepEqual(findManyArgs, {
    select: {
      id: true,
      actorUserId: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
    where: {
      actorUserId: { contains: "user-1" },
      action: "USER_SESSION_REVOKED",
      entityType: "User",
      createdAt: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T23:59:59.999Z"),
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 2,
  });
});

test("Audit reader checks disposition existence through the owned reader", async () => {
  let findFirstArgs: unknown;
  const db = {
    auditLog: {
      count: async () => 0,
      findMany: async () => [],
      findFirst: async (args: unknown) => {
        findFirstArgs = args;
        return { id: "audit-1" };
      },
    },
  };
  const reader = new PrismaAuditReader(
    db as unknown as ConstructorParameters<typeof PrismaAuditReader>[0],
  );
  const createdAtGte = new Date("2026-09-18T10:00:00.000Z");

  assert.equal(
    await reader.exists({
      actions: ["ADMIN_ISSUE_RESOLVED", "ADMIN_ISSUE_DISMISSED"],
      entityType: "AdminIssue",
      entityId: "issue-1",
      createdAtGte,
    }),
    true,
  );
  assert.deepEqual(findFirstArgs, {
    where: {
      action: { in: ["ADMIN_ISSUE_RESOLVED", "ADMIN_ISSUE_DISMISSED"] },
      entityType: "AdminIssue",
      entityId: "issue-1",
      createdAt: { gte: createdAtGte },
    },
    select: { id: true },
  });
});
