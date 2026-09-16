import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import type { PlatformAdminRepository } from "../apps/api/src/modules/platform-admin/application/platform-admin.repository.js";
import { PlatformAdminService } from "../apps/api/src/modules/platform-admin/application/platform-admin.service.js";
import { PrismaPlatformAdminRepository } from "../apps/api/src/modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";

type FailedGroup = {
  readonly topic: string;
  readonly aggregateType: string | null;
  readonly aggregateId: string | null;
  readonly _count: { readonly _all: number };
  readonly _min: { readonly createdAt: Date | null };
  readonly _max: { readonly updatedAt: Date | null };
};

type DispositionRecord = {
  readonly entityId: string;
  readonly createdAt: Date;
};

function failedGroup(topic: string, updatedAt: string, aggregateId = topic): FailedGroup {
  const updated = new Date(updatedAt);
  return {
    topic,
    aggregateType: "OutboxEvent",
    aggregateId,
    _count: { _all: 1 },
    _min: { createdAt: updated },
    _max: { updatedAt: updated },
  };
}

function createRepository(
  groups: readonly FailedGroup[],
  dispositions: readonly DispositionRecord[] = [],
) {
  const auditCreates: unknown[] = [];
  const db = {
    outboxEvent: {
      groupBy: async (args: {
        readonly where?: {
          readonly topic?: string;
          readonly aggregateType?: string | null;
          readonly aggregateId?: string | null;
        };
        readonly skip?: number;
        readonly take?: number;
      }) => {
        const filtered = groups.filter(
          (group) =>
            (args.where?.topic === undefined || group.topic === args.where.topic) &&
            (args.where?.aggregateType === undefined ||
              group.aggregateType === args.where.aggregateType) &&
            (args.where?.aggregateId === undefined || group.aggregateId === args.where.aggregateId),
        );
        const skip = args.skip ?? 0;
        return filtered.slice(skip, skip + (args.take ?? filtered.length));
      },
    },
    auditLog: {
      findFirst: async (args: {
        readonly where: { readonly entityId: string; readonly createdAt?: { readonly gte?: Date } };
      }) =>
        dispositions.some(
          (record) =>
            record.entityId === args.where.entityId &&
            (!args.where.createdAt?.gte || record.createdAt >= args.where.createdAt.gte),
        )
          ? { id: "audit-hidden" }
          : null,
      create: async (args: { readonly data: unknown }) => {
        auditCreates.push(args.data);
        return { id: "audit-created" };
      },
    },
  };
  return {
    repository: new PrismaPlatformAdminRepository(
      db as unknown as ConstructorParameters<typeof PrismaPlatformAdminRepository>[0],
    ),
    auditCreates,
  };
}

function disposition(entityId: string, createdAt: string): DispositionRecord {
  return { entityId, createdAt: new Date(createdAt) };
}

function createServiceRepository(overrides: Partial<PlatformAdminRepository> = {}) {
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
    auditEntries: async () => [],
    adminIssues: async () => [],
    setAdminIssueDisposition: async () => true,
    ...overrides,
  };
  return repository;
}

async function rejectsWithCode(task: () => Promise<unknown>, code: string) {
  await assert.rejects(task, (reason) => reason instanceof AppError && reason.code === code);
}

test("Admin Issues scans past dismissed recent outbox groups before applying the response limit", async () => {
  const recent = failedGroup("telegram.delivery.recent", "2026-09-16T04:00:00.000Z", "recent");
  const older = failedGroup("telegram.delivery.older", "2026-09-16T03:00:00.000Z", "older");
  const seed = createRepository([recent, older]);
  const [recentIssue] = await seed.repository.adminIssues(1);
  assert.ok(recentIssue);

  const { repository } = createRepository(
    [recent, older],
    [disposition(recentIssue.id, "2026-09-16T04:00:00.000Z")],
  );
  const issues = await repository.adminIssues(1);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.source, "OUTBOX");
  assert.equal(issues[0]?.entityId, "older");
  assert.equal(issues[0]?.occurrenceCount, 1);
  assert.deepEqual(Object.keys(issues[0] ?? {}).sort(), [
    "createdAt",
    "entityId",
    "entityType",
    "id",
    "occurrenceCount",
    "severity",
    "source",
    "summary",
    "title",
    "updatedAt",
  ]);
});

test("Admin Issue summaries expose only safe operational metadata", async () => {
  const group = {
    ...failedGroup("telegram.delivery.failed", "2026-09-16T04:00:00.000Z", "delivery-1"),
    payload: { token: "secret-token", body: "private body" },
    lastError: "database-url postgres://secret",
  };
  const { repository } = createRepository([group]);
  const [issue] = await repository.adminIssues(1);

  assert.ok(issue);
  assert.deepEqual(Object.keys(issue).sort(), [
    "createdAt",
    "entityId",
    "entityType",
    "id",
    "occurrenceCount",
    "severity",
    "source",
    "summary",
    "title",
    "updatedAt",
  ]);
  assert.equal(JSON.stringify(issue).includes("secret-token"), false);
  assert.equal(JSON.stringify(issue).includes("private body"), false);
  assert.equal(JSON.stringify(issue).includes("postgres://secret"), false);
});

test("Admin Issue disposition validates the exact decoded outbox group instead of adminIssues page size", async () => {
  const groups = Array.from({ length: 101 }, (_, index) =>
    failedGroup(
      `telegram.delivery.hidden-${index}`,
      new Date(Date.UTC(2026, 8, 16, 4, index)).toISOString(),
      `hidden-${index}`,
    ),
  );
  const older = failedGroup("telegram.delivery.older", "2026-09-16T02:00:00.000Z", "older");
  const seed = createRepository([older]);
  const [olderIssue] = await seed.repository.adminIssues(1);
  assert.ok(olderIssue);

  const hiddenDispositions: DispositionRecord[] = [];
  const seedForHidden = createRepository(groups);
  for (const issue of await seedForHidden.repository.adminIssues(101)) {
    hiddenDispositions.push(disposition(issue.id, issue.updatedAt));
  }

  const { repository, auditCreates } = createRepository([...groups, older], hiddenDispositions);
  const updated = await repository.setAdminIssueDisposition(
    "admin-user",
    olderIssue.id,
    "RESOLVED",
    " investigated ",
  );

  assert.equal(updated, true);
  assert.equal(auditCreates.length, 1);
  assert.deepEqual(auditCreates[0], {
    actorUserId: "admin-user",
    action: "ADMIN_ISSUE_RESOLVED",
    entityType: "AdminIssue",
    entityId: olderIssue.id,
    metadata: {
      source: "OUTBOX",
      topic: "telegram.delivery.older",
      aggregateType: "OutboxEvent",
      aggregateId: "older",
      note: "investigated",
    },
  });
});

test("Admin Issues re-surface when a new failed occurrence appears after disposition", async () => {
  const original = failedGroup("telegram.delivery.retry", "2026-09-16T04:00:00.000Z", "retry");
  const seed = createRepository([original]);
  const [originalIssue] = await seed.repository.adminIssues(1);
  assert.ok(originalIssue);

  const replayed = failedGroup("telegram.delivery.retry", "2026-09-16T04:05:00.000Z", "retry");
  const { repository } = createRepository(
    [replayed],
    [disposition(originalIssue.id, "2026-09-16T04:00:01.000Z")],
  );

  const issues = await repository.adminIssues(1);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.id, originalIssue.id);
  assert.equal(issues[0]?.updatedAt, "2026-09-16T04:05:00.000Z");
});

test("Admin Issue resolve and dismiss require a non-empty reason", async () => {
  const service = new PlatformAdminService(createServiceRepository());

  await rejectsWithCode(
    () => service.resolveIssue("platform-admin", "issue-1", "   "),
    "ADMIN_ISSUE_REASON_REQUIRED",
  );
  await rejectsWithCode(
    () => service.dismissIssue("platform-admin", "issue-1", null),
    "ADMIN_ISSUE_REASON_REQUIRED",
  );
});

test("Admin Issue disposition remains Platform Admin only while VIEW_AUDIT managers can read", async () => {
  const calls: string[] = [];
  const service = new PlatformAdminService(
    createServiceRepository({
      adminIssues: async () => {
        calls.push("read");
        return [];
      },
      setAdminIssueDisposition: async () => {
        calls.push("write");
        return true;
      },
    }),
  );

  await service.issues("audit-manager", 25);
  await rejectsWithCode(
    () => service.resolveIssue("audit-manager", "issue-1", "investigated failure"),
    "PLATFORM_ADMIN_REQUIRED",
  );
  await rejectsWithCode(() => service.issues("normal-user", 25), "APP_MANAGER_CAPABILITY_REQUIRED");
  assert.deepEqual(calls, ["read"]);
});
