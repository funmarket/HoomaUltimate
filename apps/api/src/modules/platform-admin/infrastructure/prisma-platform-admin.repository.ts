import type { AdminIssueSummary, PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import type { PrismaClient } from "@hooma/database";
import type {
  AdminIssueDisposition,
  AppManagerRecord,
  PlatformAdminAuditEntry,
  PlatformAdminOverview,
  PlatformAdminRepository,
} from "../application/platform-admin.repository.js";

type OutboxIssueKey = {
  readonly source: "OUTBOX";
  readonly topic: string;
  readonly aggregateType: string | null;
  readonly aggregateId: string | null;
};

type FailedOutboxIssueGroup = {
  readonly topic: string;
  readonly aggregateType: string | null;
  readonly aggregateId: string | null;
  readonly _count: { readonly _all: number };
  readonly _min: { readonly createdAt: Date | null };
  readonly _max: { readonly updatedAt: Date | null };
};

const ISSUE_RESOLUTION_ACTIONS = ["ADMIN_ISSUE_RESOLVED", "ADMIN_ISSUE_DISMISSED"] as const;

function encodeOutboxIssueId(key: OutboxIssueKey): string {
  return `outbox:${Buffer.from(JSON.stringify(key)).toString("base64url")}`;
}

function decodeOutboxIssueId(issueId: string): OutboxIssueKey | null {
  if (!issueId.startsWith("outbox:")) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(issueId.slice("outbox:".length), "base64url").toString("utf8"),
    ) as Partial<OutboxIssueKey>;
    if (parsed.source !== "OUTBOX" || typeof parsed.topic !== "string") return null;
    return {
      source: "OUTBOX",
      topic: parsed.topic,
      aggregateType: typeof parsed.aggregateType === "string" ? parsed.aggregateType : null,
      aggregateId: typeof parsed.aggregateId === "string" ? parsed.aggregateId : null,
    };
  } catch {
    return null;
  }
}

export class PrismaPlatformAdminRepository implements PlatformAdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async hasPlatformAdminRole(userId: string): Promise<boolean> {
    return Boolean(
      await this.db.platformRoleAssignment.findFirst({
        where: { userId, role: "PLATFORM_ADMIN", revokedAt: null },
        select: { id: true },
      }),
    );
  }

  async managerCapabilities(userId: string): Promise<readonly PlatformManagerCapability[]> {
    const grants = await this.db.appManagerGrant.findMany({
      where: { userId, revokedAt: null },
      select: { capability: true },
      orderBy: { capability: "asc" },
    });
    return grants.map((grant) => grant.capability);
  }

  async findUserByTelegramId(telegramUserId: bigint): Promise<string | null> {
    const identity = await this.db.telegramIdentity.findUnique({
      where: { telegramUserId },
      select: { userId: true },
    });
    return identity?.userId ?? null;
  }

  async findUserByUsername(username: string): Promise<string | null> {
    const presentation = await this.db.userPresentation.findUnique({
      where: { username },
      select: { userId: true },
    });
    return presentation?.userId ?? null;
  }

  async reconcilePlatformOwner(userId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const currentOwner = await tx.platformRoleAssignment.findUnique({
        where: { userId_role: { userId, role: "PLATFORM_ADMIN" } },
        select: { revokedAt: true },
      });
      const otherActiveAdmins = await tx.platformRoleAssignment.count({
        where: { role: "PLATFORM_ADMIN", revokedAt: null, userId: { not: userId } },
      });
      const changed = !currentOwner || currentOwner.revokedAt !== null || otherActiveAdmins > 0;

      await tx.platformRoleAssignment.updateMany({
        where: { role: "PLATFORM_ADMIN", revokedAt: null, userId: { not: userId } },
        data: { revokedAt: new Date() },
      });
      await tx.platformRoleAssignment.upsert({
        where: { userId_role: { userId, role: "PLATFORM_ADMIN" } },
        create: { userId, role: "PLATFORM_ADMIN", grantedBy: "configured-platform-owner" },
        update: { revokedAt: null, grantedAt: new Date(), grantedBy: "configured-platform-owner" },
      });

      if (changed) {
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "PLATFORM_OWNER_RECONCILED",
            entityType: "User",
            entityId: userId,
            metadata: { source: "PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID" },
          },
        });
      }
    });
  }

  async listManagers(): Promise<readonly AppManagerRecord[]> {
    const users = await this.db.user.findMany({
      where: { appManagerGrants: { some: { revokedAt: null } } },
      select: {
        id: true,
        presentation: { select: { username: true, displayName: true } },
        appManagerGrants: {
          where: { revokedAt: null },
          select: { capability: true },
          orderBy: { capability: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return users
      .filter((user) => user.presentation)
      .map((user) => ({
        userId: user.id,
        username: user.presentation!.username,
        displayName: user.presentation!.displayName,
        capabilities: user.appManagerGrants.map((grant) => grant.capability),
      }));
  }

  async setManagerCapabilities(
    actorUserId: string,
    targetUserId: string,
    capabilities: readonly PlatformManagerCapability[],
  ): Promise<void> {
    const uniqueCapabilities = [...new Set(capabilities)];
    await this.db.$transaction(async (tx) => {
      await tx.appManagerGrant.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
          ...(uniqueCapabilities.length ? { capability: { notIn: uniqueCapabilities } } : {}),
        },
        data: { revokedAt: new Date() },
      });
      for (const capability of uniqueCapabilities) {
        await tx.appManagerGrant.upsert({
          where: { userId_capability: { userId: targetUserId, capability } },
          create: {
            userId: targetUserId,
            capability,
            grantedByUserId: actorUserId,
          },
          update: {
            grantedByUserId: actorUserId,
            grantedAt: new Date(),
            revokedAt: null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "APP_MANAGER_CAPABILITIES_SET",
          entityType: "User",
          entityId: targetUserId,
          metadata: { capabilities: uniqueCapabilities },
        },
      });
    });
  }

  async overview(): Promise<PlatformAdminOverview> {
    const [users, activePlatformAdmins, activeAppManagers, auditEntries] =
      await this.db.$transaction([
        this.db.user.count(),
        this.db.platformRoleAssignment.count({
          where: { role: "PLATFORM_ADMIN", revokedAt: null },
        }),
        this.db.user.count({ where: { appManagerGrants: { some: { revokedAt: null } } } }),
        this.db.auditLog.count(),
      ]);
    return { users, activePlatformAdmins, activeAppManagers, auditEntries };
  }

  async auditEntries(limit: number): Promise<readonly PlatformAdminAuditEntry[]> {
    return this.db.auditLog.findMany({
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  private async outboxIssueDispositionExists(issueId: string, updatedAt: Date): Promise<boolean> {
    const disposition = await this.db.auditLog.findFirst({
      where: {
        action: { in: [...ISSUE_RESOLUTION_ACTIONS] },
        entityType: "AdminIssue",
        entityId: issueId,
        createdAt: { gte: updatedAt },
      },
      select: { id: true },
    });
    return Boolean(disposition);
  }

  private outboxIssueFromGroup(group: FailedOutboxIssueGroup): AdminIssueSummary {
    const updatedAt = group._max.updatedAt ?? new Date();
    const createdAt = group._min.createdAt ?? updatedAt;
    const key: OutboxIssueKey = {
      source: "OUTBOX",
      topic: group.topic,
      aggregateType: group.aggregateType,
      aggregateId: group.aggregateId,
    };
    return {
      id: encodeOutboxIssueId(key),
      title: "Outbox delivery failed",
      summary: `The ${group.topic} outbox pipeline has failed delivery events requiring operator attention.`,
      severity: "WARNING",
      source: "OUTBOX",
      occurrenceCount: group._count._all,
      entityType: group.aggregateType ?? "OutboxEvent",
      entityId: group.aggregateId,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }

  async adminIssues(limit: number): Promise<readonly AdminIssueSummary[]> {
    const issues: AdminIssueSummary[] = [];
    const batchSize = Math.min(Math.max(limit * 2, 25), 100);
    let skip = 0;

    while (issues.length < limit) {
      const failedOutboxGroups = await this.db.outboxEvent.groupBy({
        by: ["topic", "aggregateType", "aggregateId"],
        where: { status: "FAILED" },
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { updatedAt: true },
        orderBy: { _max: { updatedAt: "desc" } },
        skip,
        take: batchSize,
      });
      if (!failedOutboxGroups.length) break;

      for (const group of failedOutboxGroups) {
        const issue = this.outboxIssueFromGroup(group);
        if (await this.outboxIssueDispositionExists(issue.id, new Date(issue.updatedAt))) continue;
        issues.push(issue);
        if (issues.length >= limit) break;
      }
      skip += failedOutboxGroups.length;
    }

    return issues;
  }

  async setAdminIssueDisposition(
    actorUserId: string,
    issueId: string,
    disposition: AdminIssueDisposition,
    note: string,
  ): Promise<boolean> {
    const key = decodeOutboxIssueId(issueId);
    if (!key) return false;
    const failedOutboxGroups = await this.db.outboxEvent.groupBy({
      by: ["topic", "aggregateType", "aggregateId"],
      where: {
        status: "FAILED",
        topic: key.topic,
        aggregateType: key.aggregateType,
        aggregateId: key.aggregateId,
      },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { updatedAt: true },
      orderBy: { _max: { updatedAt: "desc" } },
      take: 1,
    });
    const [group] = failedOutboxGroups;
    if (!group) return false;
    const issue = this.outboxIssueFromGroup(group);
    if (issue.id !== issueId) return false;
    if (await this.outboxIssueDispositionExists(issueId, new Date(issue.updatedAt))) return false;
    await this.db.auditLog.create({
      data: {
        actorUserId,
        action: disposition === "RESOLVED" ? "ADMIN_ISSUE_RESOLVED" : "ADMIN_ISSUE_DISMISSED",
        entityType: "AdminIssue",
        entityId: issueId,
        metadata: {
          source: key.source,
          topic: key.topic,
          aggregateType: key.aggregateType,
          aggregateId: key.aggregateId,
          note: note.trim(),
        },
      },
    });
    return true;
  }
}
