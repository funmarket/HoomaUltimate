import type { TelegramIdentityInput } from "@hooma/auth";
import type { Prisma, PrismaClient } from "@hooma/database";
import type { IdentityRepository, MeRecord, SessionRecord, WebCredentialRecord } from "../application/identity.repository.js";

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: PrismaClient) {}
  async createWebIdentity(input: { loginUsername: string; passwordHash: string; email: string | null; displayUsername: string; displayName: string; }): Promise<string> {
    return this.db.$transaction(async (tx) => { const user = await tx.user.create({ data: {} }); await tx.userPresentation.create({ data: { userId: user.id, username: input.displayUsername, displayName: input.displayName } }); await tx.webCredential.create({ data: { userId: user.id, loginUsername: input.loginUsername, passwordHash: input.passwordHash, email: input.email } }); return user.id; });
  }
  findWebCredential(loginUsername: string): Promise<WebCredentialRecord | null> { return this.db.webCredential.findUnique({ where: { loginUsername }, select: { userId: true, passwordHash: true, failedLoginCount: true, lockedUntil: true } }); }
  async recordLoginFailure(userId: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void> { await this.db.webCredential.update({ where: { userId }, data: { failedLoginCount, lockedUntil } }); }
  async recordLoginSuccess(userId: string): Promise<void> { await this.db.webCredential.update({ where: { userId }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }); }
  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> { await this.db.webSession.create({ data: { userId, tokenHash, expiresAt } }); }
  findActiveSession(tokenHash: string): Promise<SessionRecord | null> { return this.db.webSession.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, select: { userId: true } }); }
  async revokeSession(tokenHash: string): Promise<void> { await this.db.webSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }); }
  async upsertTelegramIdentity(input: TelegramIdentityInput): Promise<string> {
    const existing = await this.db.telegramIdentity.findUnique({ where: { telegramUserId: input.telegramUserId }, select: { userId: true } });
    if (existing) { await this.db.telegramIdentity.update({ where: { userId: existing.userId }, data: { telegramUsername: input.username ?? null, firstName: input.firstName ?? null, lastName: input.lastName ?? null, photoUrl: input.photoUrl ?? null, languageCode: input.languageCode ?? null, isPremium: input.isPremium ?? false, lastAuthenticatedAt: new Date() } }); return existing.userId; }
    return this.db.$transaction(async (tx) => { const user = await tx.user.create({ data: {} }); await tx.telegramIdentity.create({ data: { userId: user.id, telegramUserId: input.telegramUserId, telegramUsername: input.username ?? null, firstName: input.firstName ?? null, lastName: input.lastName ?? null, photoUrl: input.photoUrl ?? null, languageCode: input.languageCode ?? null, isPremium: input.isPremium ?? false } }); const username = await this.uniqueTelegramUsername(tx, input); await tx.userPresentation.create({ data: { userId: user.id, username, displayName: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || input.username || "HOOMA member", photoUrl: input.photoUrl ?? null } }); return user.id; });
  }
  async findMe(userId: string): Promise<MeRecord | null> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: {
      id: true, presentation: { select: { username: true, displayName: true, photoUrl: true, bio: true } },
      platformRoles: { where: { revokedAt: null, role: "PLATFORM_ADMIN" }, select: { role: true } },
      communityMemberships: { where: { leftAt: null }, select: { role: true, community: { select: { id: true, name: true, slug: true } } }, orderBy: { joinedAt: "asc" } },
      teamPlayers: { where: { leftAt: null }, select: { team: { select: { id: true, name: true, slug: true, badgeUrl: true } } } },
      teamResponsibilities: { where: { revokedAt: null }, select: { role: true, team: { select: { id: true, name: true, slug: true, badgeUrl: true } } } },
      teamCapabilityGrants: { where: { revokedAt: null }, select: { teamId: true, capability: true } }
    } });
    if (!user?.presentation) return null;
    const teamMap = new Map<string, { id: string; name: string; slug: string; badgeUrl: string | null; isPlayer: boolean; responsibilities: ("COACH" | "ASSISTANT")[]; capabilities: ("EDIT_TEAM" | "MANAGE_ROSTER" | "MANAGE_LINEUP" | "CREATE_CHALLENGE" | "RESPOND_TO_CHALLENGE" | "MANAGE_TEAM_EVENTS")[]; }>();
    for (const row of user.teamPlayers) teamMap.set(row.team.id, { ...row.team, isPlayer: true, responsibilities: [], capabilities: [] });
    for (const row of user.teamResponsibilities) { const existing = teamMap.get(row.team.id) ?? { ...row.team, isPlayer: false, responsibilities: [], capabilities: [] }; if (!existing.responsibilities.includes(row.role)) existing.responsibilities.push(row.role); teamMap.set(row.team.id, existing); }
    for (const grant of user.teamCapabilityGrants) { const existing = teamMap.get(grant.teamId); if (existing && !existing.capabilities.includes(grant.capability)) existing.capabilities.push(grant.capability); }
    return { id: user.id, presentation: user.presentation, platformRoles: user.platformRoles.map(() => "PLATFORM_ADMIN" as const), communities: user.communityMemberships.map((membership) => ({ ...membership.community, role: membership.role })), teams: [...teamMap.values()] };
  }
  private async uniqueTelegramUsername(tx: Prisma.TransactionClient, input: TelegramIdentityInput): Promise<string> {
    const base = (input.username || `tg_${input.telegramUserId.toString()}`).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 48).toLowerCase(); let candidate = base; let suffix = 0;
    while (await tx.userPresentation.findUnique({ where: { username: candidate }, select: { userId: true } })) { suffix += 1; candidate = `${base}_${suffix}`.slice(0, 64); }
    return candidate;
  }
}
