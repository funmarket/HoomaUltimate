import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import type {
  PlatformAdminAuditPage,
  PlatformAdminAuditQuery,
} from "../apps/api/src/modules/platform-admin/application/platform-admin.repository.js";
import type { PlatformAdminRepository } from "../apps/api/src/modules/platform-admin/application/platform-admin.repository.js";
import { PlatformAdminService } from "../apps/api/src/modules/platform-admin/application/platform-admin.service.js";
import { PrismaPlatformAdminRepository } from "../apps/api/src/modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";

function createServiceRepository(overrides: Partial<PlatformAdminRepository> = {}) {
  const auditQueries: PlatformAdminAuditQuery[] = [];
  const repository: PlatformAdminRepository = {
    hasPlatformAdminRole: async (userId) => userId === "platform-admin",
    managerCapabilities: async (userId) => (userId === "audit-manager" ? ["VIEW_AUDIT"] : []),
    findUserByTelegramId: async () => null,
    findUserByUsername: async () => null,
    reconcilePlatformOwner: async () => {},
    listManagers: async () => [],
    setManagerCapabilities: async () => {},
    overview: async () => ({
      users: 0,
      activePlatformAdmins: 0,
      activeAppManagers: 0,
      auditEntries: 0,
    }),
    auditEntries: async (query) => {
      auditQueries.push(query);
      return { items: [], nextCursor: null } satisfies PlatformAdminAuditPage;
    },
    adminIssues: async () => [],
    setAdminIssueDisposition: async () => true,
    ...overrides,
  };
  return { repository, auditQueries };
}

async function rejectsWithCode(task: () => Promise<unknown>, code: string) {
  await assert.rejects(task, (reason) => reason instanceof AppError && reason.code === code);
}

test("Audit Archive keeps VIEW_AUDIT authorization and normalizes safe filter queries", async () => {
  const { repository, auditQueries } = createServiceRepository();
  const service = new PlatformAdminService(repository);

  await rejectsWithCode(
    () =>
      service.audit("normal-user", {
        actor: "user-1",
        action: "USER_SESSION_REVOKED",
        entityType: "User",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-30T23:59:59.999Z",
        limit: 500,
      }),
    "APP_MANAGER_CAPABILITY_REQUIRED",
  );

  const page = await service.audit("audit-manager", {
    actor: " user-1 ",
    action: " USER_SESSION_REVOKED ",
    entityType: " User ",
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-09-30T23:59:59.999Z",
    limit: 500,
  });

  assert.deepEqual(page, { items: [], nextCursor: null });
  assert.equal(auditQueries.length, 1);
  assert.deepEqual(auditQueries[0], {
    actor: "user-1",
    action: "USER_SESSION_REVOKED",
    entityType: "User",
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.999Z"),
    limit: 100,
    cursor: null,
  });
});

test("Audit Archive repository filters safely and returns cursor pages without metadata exposure", async () => {
  let findManyArgs: unknown;
  const rows = [
    {
      id: "audit-new",
      actorUserId: "user-1",
      action: "USER_SESSION_REVOKED",
      entityType: "User",
      entityId: "target-1",
      createdAt: new Date("2026-09-18T10:00:00.000Z"),
      metadata: { token: "secret-token", requestBody: "private" },
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
      findMany: async (args: unknown) => {
        findManyArgs = args;
        return rows;
      },
    },
  };
  const repository = new PrismaPlatformAdminRepository(
    db as unknown as ConstructorParameters<typeof PrismaPlatformAdminRepository>[0],
  );

  const page = await repository.auditEntries({
    actor: "user-1",
    action: "USER_SESSION_REVOKED",
    entityType: "User",
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.999Z"),
    limit: 1,
    cursor: null,
  });

  assert.equal(page.items.length, 1);
  assert.deepEqual(Object.keys(page.items[0] ?? {}).sort(), [
    "action",
    "actorUserId",
    "createdAt",
    "entityId",
    "entityType",
    "id",
  ]);
  assert.equal(JSON.stringify(page).includes("secret-token"), false);
  assert.equal(JSON.stringify(page).includes("requestBody"), false);
  assert.ok(page.nextCursor);
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
