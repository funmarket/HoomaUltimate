import type {
  AdminUserDetail,
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

export class PrismaIdentityAdminRepository implements IdentityAdminRepository {
  constructor(private readonly db: PrismaClient) {}

  async searchAdminUsers(query: string, limit: number): Promise<readonly AdminUserSearchItem[]> {
    const telegramUserId = maybeTelegramUserId(query);
    const now = new Date();
    const users = await this.db.user.findMany({
      where: {
        OR: [
          { id: query },
          { presentation: { username: { contains: query, mode: "insensitive" } } },
          { presentation: { displayName: { contains: query, mode: "insensitive" } } },
          { webCredential: { loginUsername: { contains: query, mode: "insensitive" } } },
          { webCredential: { email: { contains: query, mode: "insensitive" } } },
          { telegramIdentity: { telegramUsername: { contains: query, mode: "insensitive" } } },
          ...(telegramUserId ? [{ telegramIdentity: { telegramUserId } }] : []),
        ],
      },
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
}
