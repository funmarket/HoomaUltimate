import type {
  AdminUserDetail,
  AdminUserModerationStatus,
  AdminUserSanctionEvent,
  AdminUserSanctionType,
  AdminUserSearchItem,
  AdminUserSessionSummary,
  PlatformManagerCapability,
} from "@hooma/contracts/platform-admin";
import type { PrismaClient } from "@hooma/database";
import type { IdentityAdminRepository } from "../application/identity-admin.service.js";

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function maybeTelegramUserId(query: string): bigint | undefined {
  if (!/^\d+$/.test(query)) return undefined;
  try {
    return BigInt(query);
  } catch {
    return undefined;
  }
}

function sessionSummary(
  session: {
    readonly id: string;
    readonly createdAt: Date;
    readonly lastSeenAt: Date;
    readonly expiresAt: Date;
    readonly revokedAt: Date | null;
  },
  now: Date,
): AdminUserSessionSummary {
  return {
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: iso(session.revokedAt),
    isActive: session.revokedAt === null && session.expiresAt > now,
  };
}

function activeSessionCount(
  sessions: readonly { readonly expiresAt: Date; readonly revokedAt: Date | null }[],
  now: Date,
): number {
  return sessions.filter((session) => session.revokedAt === null && session.expiresAt > now).length;
}

type SanctionRow = {
  readonly id: string;
  readonly actorUserId: string;
  readonly actionType: AdminUserSanctionType;
  readonly reason: string;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly clearedAt: Date | null;
};

function isActiveSanction(sanction: SanctionRow, now: Date): boolean {
  return sanction.clearedAt === null && (!sanction.expiresAt || sanction.expiresAt > now);
}

function sanctionEvent(sanction: SanctionRow): AdminUserSanctionEvent {
  return {
    id: sanction.id,
    actorUserId: sanction.actorUserId,
    actionType: sanction.actionType,
    reason: sanction.reason,
    createdAt: sanction.createdAt.toISOString(),
    expiresAt: iso(sanction.expiresAt),
    clearedAt: iso(sanction.clearedAt),
  };
}

function moderationStatus(sanctions: readonly SanctionRow[], now: Date): AdminUserModerationStatus {
  const active = sanctions.filter((sanction) => isActiveSanction(sanction, now));
  const activeBan = active.find(
    (sanction) => sanction.actionType === "RED_CARD_BAN" || sanction.actionType === "TEMPORARY_BAN",
  );
  const activeReadOnly = active.find((sanction) => sanction.actionType === "READ_ONLY");
  const latestRedCard = sanctions.find((sanction) => sanction.actionType === "RED_CARD_BAN");
  const yellowCardCount = sanctions.filter(
    (sanction) =>
      sanction.actionType === "YELLOW_CARD_WARNING" &&
      sanction.clearedAt === null &&
      (!latestRedCard || sanction.createdAt > latestRedCard.createdAt),
  ).length;
  return {
    yellowCardCount,
    isBanned: Boolean(activeBan),
    banExpiresAt: iso(activeBan?.expiresAt ?? null),
    isReadOnly: Boolean(activeReadOnly),
    readOnlyExpiresAt: iso(activeReadOnly?.expiresAt ?? null),
    isDisabled: active.some((sanction) => sanction.actionType === "ACCOUNT_DISABLED"),
    activeSanctions: active.map(sanctionEvent),
    history: sanctions.map(sanctionEvent),
  };
}

export class PrismaIdentityAdminRepository implements IdentityAdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async searchAdminUsers(query: string, limit: number): Promise<readonly AdminUserSearchItem[]> {
    const hasQuery = query.length > 0;
    const telegramUserId = hasQuery ? maybeTelegramUserId(query) : undefined;
    const now = new Date();
    const where = hasQuery
      ? {
          OR: [
            { id: query },
            { presentation: { username: { contains: query, mode: "insensitive" as const } } },
            { presentation: { displayName: { contains: query, mode: "insensitive" as const } } },
            { webCredential: { loginUsername: { contains: query, mode: "insensitive" as const } } },
            { webCredential: { email: { contains: query, mode: "insensitive" as const } } },
            {
              telegramIdentity: {
                telegramUsername: { contains: query, mode: "insensitive" as const },
              },
            },
            ...(telegramUserId ? [{ telegramIdentity: { telegramUserId } }] : []),
          ],
        }
      : {};
    const users = await this.db.user.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        presentation: { select: { username: true, displayName: true, photoUrl: true } },
        webCredential: { select: { lastLoginAt: true } },
        telegramIdentity: { select: { telegramUsername: true } },
        webSessions: { select: { expiresAt: true, revokedAt: true } },
        platformRoles: { where: { role: "PLATFORM_ADMIN", revokedAt: null }, select: { id: true } },
        appManagerGrants: {
          where: { revokedAt: null },
          select: { capability: true },
          orderBy: { capability: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return users
      .filter((user) => user.presentation)
      .map((user) => ({
        userId: user.id,
        username: user.presentation!.username,
        displayName: user.presentation!.displayName,
        photoUrl: user.presentation!.photoUrl,
        telegramUsername: user.telegramIdentity?.telegramUsername ?? null,
        hasWebCredential: Boolean(user.webCredential),
        lastLoginAt: iso(user.webCredential?.lastLoginAt ?? null),
        activeSessionCount: activeSessionCount(user.webSessions, now),
        isPlatformAdmin: user.platformRoles.length > 0,
        managerCapabilities: user.appManagerGrants.map((grant) => grant.capability),
      }));
  }

  async findAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
    const now = new Date();
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        presentation: { select: { username: true, displayName: true, photoUrl: true } },
        webCredential: { select: { loginUsername: true, email: true, lastLoginAt: true } },
        telegramIdentity: {
          select: {
            telegramUserId: true,
            telegramUsername: true,
            lastAuthenticatedAt: true,
          },
        },
        webSessions: {
          select: {
            id: true,
            createdAt: true,
            lastSeenAt: true,
            expiresAt: true,
            revokedAt: true,
          },
          orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
          take: 20,
        },
        platformRoles: { where: { role: "PLATFORM_ADMIN", revokedAt: null }, select: { id: true } },
        appManagerGrants: {
          where: { revokedAt: null },
          select: { capability: true },
          orderBy: { capability: "asc" },
        },
        sanctionsReceived: {
          select: {
            id: true,
            actorUserId: true,
            actionType: true,
            reason: true,
            createdAt: true,
            expiresAt: true,
            clearedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!user?.presentation) return null;

    const sessions = user.webSessions.map((session) => sessionSummary(session, now));
    return {
      userId: user.id,
      presentation: {
        username: user.presentation.username,
        displayName: user.presentation.displayName,
        photoUrl: user.presentation.photoUrl,
      },
      identity: {
        web: user.webCredential
          ? {
              loginUsername: user.webCredential.loginUsername,
              email: user.webCredential.email,
              lastLoginAt: iso(user.webCredential.lastLoginAt),
            }
          : null,
        telegram: user.telegramIdentity
          ? {
              telegramUserId: user.telegramIdentity.telegramUserId.toString(),
              telegramUsername: user.telegramIdentity.telegramUsername,
              lastAuthenticatedAt: user.telegramIdentity.lastAuthenticatedAt.toISOString(),
            }
          : null,
      },
      access: {
        isPlatformAdmin: user.platformRoles.length > 0,
        managerCapabilities: user.appManagerGrants.map(
          (grant) => grant.capability as PlatformManagerCapability,
        ),
      },
      security: {
        activeSessionCount: sessions.filter((session) => session.isActive).length,
        sessions,
      },
      moderation: moderationStatus(
        user.sanctionsReceived.map((sanction) => ({
          ...sanction,
          actionType: sanction.actionType as AdminUserSanctionType,
        })),
        now,
      ),
    };
  }

  async revokeActiveUserSessions(
    actorUserId: string,
    targetUserId: string,
    reason: string,
  ): Promise<number> {
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) return 0;
      const result = await tx.webSession.updateMany({
        where: { userId: targetUserId, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: "USER_SESSIONS_REVOKED",
          entityType: "User",
          entityId: targetUserId,
          metadata: { reason: reason.trim(), revokedSessionCount: result.count },
        },
      });
      return result.count;
    });
  }

  async issueUserSanction(input: {
    sanctionId: string;
    actorUserId: string;
    targetUserId: string;
    actionType: AdminUserSanctionType;
    reason: string;
    expiresAt: Date | null;
    createdAt: Date;
  }): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.userSanction.create({
        data: {
          id: input.sanctionId,
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          actionType: input.actionType,
          reason: input.reason.trim(),
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: `USER_SANCTION_${input.actionType}`,
          entityType: "User",
          entityId: input.targetUserId,
          metadata: {
            reason: input.reason.trim(),
            expiresAt: input.expiresAt?.toISOString() ?? null,
          },
        },
      });
    });
  }

  async clearUserSanction(input: {
    actorUserId: string;
    targetUserId: string;
    sanctionId: string;
    reason: string;
  }): Promise<boolean> {
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const update = await tx.userSanction.updateMany({
        where: {
          id: input.sanctionId,
          targetUserId: input.targetUserId,
          clearedAt: null,
        },
        data: {
          clearedAt: now,
          clearedByUserId: input.actorUserId,
          clearReason: input.reason.trim(),
        },
      });
      if (update.count === 0) return false;
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "USER_SANCTION_CLEARED",
          entityType: "User",
          entityId: input.targetUserId,
          metadata: { reason: input.reason.trim(), sanctionId: input.sanctionId },
        },
      });
      return true;
    });
  }
}
