import type { Prisma, PrismaClient } from "@hooma/database";
import type { TeamCapabilityInput, TeamChallengeCreateInput, TeamCreateInput, TeamLineupInput, TeamUpdateInput } from "@hooma/contracts";
import type { TeamAccessRecord, TeamListInput, TeamRepository } from "../application/team.repository.js";

function slugify(value: string): string { return value.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "team"; }

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly db: PrismaClient) {}
  async listPublic(input: TeamListInput) {
    const search = input.search?.trim();
    const rows = await this.db.team.findMany({
      where: { status: "ACTIVE", ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }, { houma: { contains: search, mode: "insensitive" } }] } : {}), ...(input.city ? { city: { contains: input.city.trim(), mode: "insensitive" } } : {}), ...(input.houma ? { houma: { contains: input.houma.trim(), mode: "insensitive" } } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: { id: true, slug: true, name: true, motto: true, city: true, houma: true, badgeUrl: true, communityId: true, _count: { select: { players: { where: { leftAt: null } } } } }
    });
    return { items: rows.slice(0, input.limit), nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null };
  }
  getPublic(teamId: string) {
    return this.db.team.findFirst({ where: { id: teamId, status: "ACTIVE" }, select: {
      id: true, communityId: true, slug: true, name: true, motto: true, city: true, houma: true, badgeUrl: true,
      community: { select: { id: true, name: true, slug: true } },
      players: { where: { leftAt: null }, select: { userId: true, joinedAt: true, user: { select: { presentation: true } } }, orderBy: { joinedAt: "asc" } },
      responsibilities: { where: { revokedAt: null }, select: { userId: true, role: true, user: { select: { presentation: true } } } },
      lineups: { orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, formation: true, updatedAt: true, slots: { orderBy: { sortOrder: "asc" } } } }
    } });
  }
  listManaged(userId: string) {
    return this.db.team.findMany({ where: { status: "ACTIVE", OR: this.managedTeamFilters(userId) }, select: { id: true, slug: true, name: true, badgeUrl: true, communityId: true, city: true, houma: true }, orderBy: { name: "asc" } });
  }
  async access(teamId: string, userId: string): Promise<TeamAccessRecord | null> {
    const team = await this.db.team.findUnique({ where: { id: teamId }, select: {
      status: true, communityId: true,
      responsibilities: { where: { userId, revokedAt: null }, select: { role: true } },
      capabilityGrants: { where: { userId, revokedAt: null }, select: { capability: true } },
      community: { select: { memberships: { where: { userId, leftAt: null }, select: { role: true } } } }
    } });
    if (!team || team.status !== "ACTIVE") return null;
    const responsibility = team.responsibilities.find((row) => row.role === "COACH")?.role ?? team.responsibilities[0]?.role ?? null;
    return { communityId: team.communityId, responsibility, grants: team.capabilityGrants.map((row) => row.capability), communityRole: team.community?.memberships[0]?.role ?? null };
  }
  async create(userId: string, input: TeamCreateInput) {
    const base = slugify(input.name); let slug = base; let suffix = 1;
    while (await this.db.team.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
    return this.db.$transaction(async (tx) => {
      const team = await tx.team.create({ data: { ...input, slug, createdByUserId: userId } });
      await tx.teamPlayer.create({ data: { teamId: team.id, userId } });
      await tx.teamResponsibilityAssignment.create({ data: { teamId: team.id, userId, role: "COACH" } });
      return team;
    });
  }
  update(teamId: string, input: TeamUpdateInput) { return this.db.team.update({ where: { id: teamId }, data: input }); }
  addPlayer(teamId: string, targetUserId: string) { return this.db.teamPlayer.upsert({ where: { teamId_userId: { teamId, userId: targetUserId } }, create: { teamId, userId: targetUserId }, update: { leftAt: null, joinedAt: new Date() } }); }
  async removePlayer(teamId: string, targetUserId: string): Promise<number> { return (await this.db.teamPlayer.updateMany({ where: { teamId, userId: targetUserId, leftAt: null }, data: { leftAt: new Date() } })).count; }
  async assignAssistant(teamId: string, targetUserId: string, capabilities: readonly TeamCapabilityInput[], coachUserId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamPlayer.upsert({ where: { teamId_userId: { teamId, userId: targetUserId } }, create: { teamId, userId: targetUserId }, update: { leftAt: null } });
      await tx.teamResponsibilityAssignment.upsert({ where: { teamId_userId_role: { teamId, userId: targetUserId, role: "ASSISTANT" } }, create: { teamId, userId: targetUserId, role: "ASSISTANT" }, update: { revokedAt: null, assignedAt: new Date() } });
      await tx.teamCapabilityGrant.updateMany({ where: { teamId, userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      for (const capability of capabilities) await tx.teamCapabilityGrant.upsert({ where: { teamId_userId_capability: { teamId, userId: targetUserId, capability } }, create: { teamId, userId: targetUserId, capability, grantedByUserId: coachUserId }, update: { revokedAt: null, grantedAt: new Date(), grantedByUserId: coachUserId } });
    });
  }
  async revokeAssistant(teamId: string, targetUserId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamResponsibilityAssignment.updateMany({ where: { teamId, userId: targetUserId, role: "ASSISTANT", revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.teamCapabilityGrant.updateMany({ where: { teamId, userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }
  createLineup(userId: string, teamId: string, input: TeamLineupInput) {
    return this.db.teamLineup.create({ data: { teamId, name: input.name, formation: input.formation ?? null, createdByUserId: userId, slots: { create: input.slots.map((slot) => ({ userId: slot.userId ?? null, position: slot.position, sortOrder: slot.sortOrder })) } }, include: { slots: { orderBy: { sortOrder: "asc" } } } });
  }
  createChallenge(userId: string, input: TeamChallengeCreateInput) { return this.db.teamChallenge.create({ data: { ...input, proposedAt: input.proposedAt ? new Date(input.proposedAt) : null, createdByUserId: userId } }); }
  getChallenge(challengeId: string) { return this.db.teamChallenge.findUnique({ where: { id: challengeId }, select: { id: true, challengerTeamId: true, challengedTeamId: true, status: true } }); }
  getChallengeForUser(challengeId: string, userId: string) { return this.db.teamChallenge.findFirst({ where: { id: challengeId, OR: this.managedChallengeTeamFilters(userId) }, include: { challengerTeam: true, challengedTeam: true, game: true } }); }
  listIncoming(userId: string, limit: number) { return this.db.teamChallenge.findMany({ where: { challengedTeam: { OR: this.managedTeamFilters(userId) } }, include: { challengerTeam: true, challengedTeam: true, game: true }, orderBy: { createdAt: "desc" }, take: limit }); }
  listOutgoing(userId: string, limit: number) { return this.db.teamChallenge.findMany({ where: { challengerTeam: { OR: this.managedTeamFilters(userId) } }, include: { challengerTeam: true, challengedTeam: true, game: true }, orderBy: { createdAt: "desc" }, take: limit }); }
  async acceptChallenge(challengeId: string) {
    return this.db.$transaction(async (tx) => {
      const challenge = await tx.teamChallenge.update({ where: { id: challengeId }, data: { status: "ACCEPTED" } });
      await tx.teamGame.create({ data: { challengeId: challenge.id, homeTeamId: challenge.challengerTeamId, awayTeamId: challenge.challengedTeamId, scheduledAt: challenge.proposedAt, status: challenge.proposedAt ? "CONFIRMED" : "SCHEDULING" } });
      return challenge;
    });
  }
  declineChallenge(challengeId: string) { return this.db.teamChallenge.update({ where: { id: challengeId }, data: { status: "DECLINED" } }); }
  cancelChallenge(challengeId: string) { return this.db.teamChallenge.update({ where: { id: challengeId }, data: { status: "CANCELLED" } }); }
  async listMessages(challengeId: string, userId: string) { if (!(await this.challengeVisibleToUser(challengeId, userId))) return null; return this.db.teamChallengeMessage.findMany({ where: { challengeId }, include: { author: { select: { presentation: true } } }, orderBy: { createdAt: "asc" } }); }
  async createMessage(challengeId: string, userId: string, body: string) { if (!(await this.challengeVisibleToUser(challengeId, userId))) return null; return this.db.teamChallengeMessage.create({ data: { challengeId, authorUserId: userId, body } }); }
  listGames(userId: string, limit: number) { return this.db.teamGame.findMany({ where: { OR: [{ homeTeam: { OR: this.managedTeamFilters(userId) } }, { awayTeam: { OR: this.managedTeamFilters(userId) } }] }, include: { homeTeam: true, awayTeam: true, challenge: true }, orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }], take: limit }); }
  getGame(gameId: string, userId: string) { return this.db.teamGame.findFirst({ where: { id: gameId, OR: [{ homeTeam: { OR: this.managedTeamFilters(userId) } }, { awayTeam: { OR: this.managedTeamFilters(userId) } }] }, include: { homeTeam: true, awayTeam: true, challenge: true } }); }
  private managedTeamFilters(userId: string): Prisma.TeamWhereInput[] { return [{ responsibilities: { some: { userId, revokedAt: null } } }, { community: { memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } } } }]; }
  private managedChallengeTeamFilters(userId: string): Prisma.TeamChallengeWhereInput[] { const managed = this.managedTeamFilters(userId); return [{ challengerTeam: { OR: managed } }, { challengedTeam: { OR: managed } }]; }
  private async challengeVisibleToUser(challengeId: string, userId: string): Promise<boolean> { return Boolean(await this.db.teamChallenge.findFirst({ where: { id: challengeId, OR: this.managedChallengeTeamFilters(userId) }, select: { id: true } })); }
}
