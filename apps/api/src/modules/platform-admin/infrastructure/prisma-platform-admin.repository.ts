import type { PlatformManagerCapability } from "@hooma/contracts/platform-management";
import type { PrismaClient } from "@hooma/database";
import type {
  AppManagerRecord,
  PlatformAdminAuditEntry,
  PlatformAdminOverview,
  PlatformAdminRepository,
} from "../application/platform-admin.repository.js";

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
    const [users, activePlatformAdmins, activeAppManagers, auditEntries] = await this.db.$transaction([
      this.db.user.count(),
      this.db.platformRoleAssignment.count({ where: { role: "PLATFORM_ADMIN", revokedAt: null } }),
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
}
