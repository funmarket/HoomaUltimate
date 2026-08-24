import type { PrismaClient } from "@hooma/database";
import type {
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

  async overview(): Promise<PlatformAdminOverview> {
    const [users, activePlatformAdmins, auditEntries] = await this.db.$transaction([
      this.db.user.count(),
      this.db.platformRoleAssignment.count({ where: { role: "PLATFORM_ADMIN", revokedAt: null } }),
      this.db.auditLog.count(),
    ]);
    return { users, activePlatformAdmins, auditEntries };
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
