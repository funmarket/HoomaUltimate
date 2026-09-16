import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPlatformAdminRepository } from "../apps/api/src/modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";

type FailedGroup = {
  readonly topic: string;
  readonly aggregateType: string | null;
  readonly aggregateId: string | null;
  readonly _count: { readonly _all: number };
  readonly _min: { readonly createdAt: Date | null };
  readonly _max: { readonly updatedAt: Date | null };
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

function createRepository(groups: readonly FailedGroup[], hiddenIssueIds = new Set<string>()) {
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
      findFirst: async (args: { readonly where: { readonly entityId: string } }) =>
        hiddenIssueIds.has(args.where.entityId) ? { id: "audit-hidden" } : null,
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

test("Admin Issues scans past dismissed recent outbox groups before applying the response limit", async () => {
  const recent = failedGroup("telegram.delivery.recent", "2026-09-16T04:00:00.000Z", "recent");
  const older = failedGroup("telegram.delivery.older", "2026-09-16T03:00:00.000Z", "older");
  const seed = createRepository([recent, older]);
  const [recentIssue] = await seed.repository.adminIssues(1);
  assert.ok(recentIssue);

  const { repository } = createRepository([recent, older], new Set([recentIssue.id]));
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

  const hiddenIds = new Set<string>();
  const seedForHidden = createRepository(groups);
  for (const issue of await seedForHidden.repository.adminIssues(101)) hiddenIds.add(issue.id);

  const { repository, auditCreates } = createRepository([...groups, older], hiddenIds);
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
