import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput
} from "@hooma/contracts";
import type { TeamAccessRecord, TeamListInput, TeamRepository } from "../application/team.repository.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "team";
}

function teamCreateData(userId: string, input: TeamCreateInput, slug: string): Prisma.TeamUncheckedCreateInput {
  return {
    communityId: input.communityId,
    name: input.name,
    slug,
    createdByUserId: userId,
    ...(input.motto !== undefined ? { motto: input.motto } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.badgeUrl !== undefined ? { badgeUrl: input.badgeUrl } : {})
  };
}

function teamUpdateData(input: TeamUpdateInput): Prisma.TeamUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.motto !== undefined ? { motto: input.motto } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.badgeUrl !== undefined ? { badgeUrl: input.badgeUrl } : {})
  };
}

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: TeamListInput) {
    const search = input.search?.trim();
    const rows = await this.db.team.findMany({
      where: {
        status: "ACTIVE",
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { houma: { contains: search, mode: "insensitive" } }
              ]
            }
          : {}),
        ...(input.city ? { city: { contains: input.city.trim(), mode: "insensitive" } } : {}),
        ...(input.houma ? { houma: { contains: input.houma.trim(), mode: "insensitive" } } : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        name: true,
        motto: true,
        city: true,
        houma: true,
        badgeUrl: true,
        communityId: true,
        _count: { select: { players: { where: { leftAt: null } } } }
      }
    });
    return {
      items: rows.slice(0, input.limit),
      nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null
    };
  }

  getPublic(teamId: string) {
    return this.db.team.findFirst({
      where: { id: teamId, status: "ACTIVE" },
      select: {
        id: true,
        communityId: true,
        slug: true,
        name: true,
        motto: true,
        city: true,
        houma: true,
        badgeUrl: true,
        community: { select: { id: true, name: true, slug: true } },
        players: {
          where: { leftAt: null },
          select: { userId: true, joinedAt: true, user: { select: { presentation: true } } },
          orderBy: { joinedAt: "asc" }
        },
        responsibilities: {
          where: { revokedAt: null },
          select: { userId: true, role: true, user: { select: { presentation: true } } }
        },
        lineups: {
          where: { published: true, active: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            name: true,
            formation: true,
            matchFormat: true,
            published: true,
            updatedAt: true,
            slots: { orderBy: { sortOrder: "asc" } }
          }
        }
      }
    });
  }

  listManaged(userId: string) {
    return this.db.team.findMany({
      where: { status: "ACTIVE", OR: this.managedTeamFilters(userId) },
      select: {
        id: true,
        slug: true,
        name: true,
        badgeUrl: true,
        communityId: true,
        city: true,
        houma: true
      },
      orderBy: { name: "asc" }
    });
  }

  async access(teamId: string, userId: string): Promise<TeamAccessRecord | null> {
    const team = await this.db.team.findUnique({
      where: { id: teamId },
      select: {
        status: true,
        communityId: true,
        responsibilities: { where: { userId, revokedAt: null }, select: { role: true } },
        capabilityGrants: { where: { userId, revokedAt: null }, select: { capability: true } },
        community: {
          select: { memberships: { where: { userId, leftAt: null }, select: { role: true } } }
        }
      }
    });
    if (!team || team.status !== "ACTIVE") return null;
    const responsibility =
      team.responsibilities.find((row) => row.role === "COACH")?.role ??
      team.responsibilities[0]?.role ??
      null;
    return {
      communityId: team.communityId,
      responsibility,
      grants: team.capabilityGrants.map((row) => row.capability),
      communityRole: team.community?.memberships[0]?.role ?? null
    };
  }

  async create(userId: string, input: TeamCreateInput) {
    const base = slugify(input.name);
    let slug = base;
    let suffix = 1;
    while (await this.db.team.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${base}-${suffix++}`;
    }
    return this.db.$transaction(async (tx) => {
      const team = await tx.team.create({ data: teamCreateData(userId, input, slug) });
      await tx.teamPlayer.create({ data: { teamId: team.id, userId } });
      await tx.teamResponsibilityAssignment.create({ data: { teamId: team.id, userId, role: "COACH" } });
      return team;
    });
  }

  update(teamId: string, input: TeamUpdateInput) {
    return this.db.team.update({ where: { id: teamId }, data: teamUpdateData(input) });
  }

  addPlayer(teamId: string, targetUserId: string) {
    return this.db.teamPlayer.upsert({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      create: { teamId, userId: targetUserId },
      update: { leftAt: null, joinedAt: new Date(), active: true }
    });
  }

  async removePlayer(teamId: string, targetUserId: string): Promise<number> {
    return (
      await this.db.teamPlayer.updateMany({
        where: { teamId, userId: targetUserId, leftAt: null },
        data: { leftAt: new Date(), active: false }
      })
    ).count;
  }

  async assignAssistant(
    teamId: string,
    targetUserId: string,
    capabilities: readonly TeamCapabilityInput[],
    coachUserId: string
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamPlayer.upsert({
        where: { teamId_userId: { teamId, userId: targetUserId } },
        create: { teamId, userId: targetUserId },
        update: { leftAt: null, active: true }
      });

      const activeAssistant = await tx.teamResponsibilityAssignment.findFirst({
        where: { teamId, userId: targetUserId, role: "ASSISTANT", revokedAt: null },
        select: { id: true }
      });
      if (!activeAssistant) {
        await tx.teamResponsibilityAssignment.create({
          data: { teamId, userId: targetUserId, role: "ASSISTANT" }
        });
      }

      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      for (const capability of capabilities) {
        await tx.teamCapabilityGrant.upsert({
          where: { teamId_userId_capability: { teamId, userId: targetUserId, capability } },
          create: {
            teamId,
            userId: targetUserId,
            capability,
            grantedBy: coachUserId
          },
          update: {
            revokedAt: null,
            grantedBy: coachUserId
          }
        });
      }
    });
  }

  async revokeAssistant(teamId: string, targetUserId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamResponsibilityAssignment.updateMany({
        where: { teamId, userId: targetUserId, role: "ASSISTANT", revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });
  }

  createLineup(userId: string, teamId: string, input: TeamLineupInput) {
    return this.db.teamLineup.create({
      data: {
        teamId,
        name: input.name,
        formation: input.formation,
        matchFormat: input.matchFormat,
        published: input.published,
        createdByUserId: userId,
        slots: {
          create: input.slots.map((slot) => ({
            userId: slot.userId ?? null,
            position: slot.position,
            sortOrder: slot.sortOrder
          }))
        }
      },
      include: { slots: { orderBy: { sortOrder: "asc" } } }
    });
  }

  createChallenge(userId: string, input: TeamChallengeCreateInput) {
    return this.db.teamChallenge.create({
      data: {
        challengerTeamId: input.challengerTeamId,
        challengedTeamId: input.challengedTeamId,
        format: input.format,
        proposedAt: input.proposedAt ? new Date(input.proposedAt) : null,
        createdByUserId: userId,
        ...(input.message !== undefined ? { message: input.message } : {})
      }
    });
  }

  getChallenge(challengeId: string) {
    return this.db.teamChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, challengerTeamId: true, challengedTeamId: true, status: true }
    });
  }

  getChallengeForUser(challengeId: string, userId: string) {
    return this.db.teamChallenge.findFirst({
      where: { id: challengeId, OR: this.challengeViewFilters(userId) },
      include: { challengerTeam: true, challengedTeam: true, game: true }
    });
  }

  listIncoming(userId: string, limit: number) {
    return this.db.teamChallenge.findMany({
      where: {
        challengedTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") }
      },
      include: { challengerTeam: true, challengedTeam: true, game: true },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  listOutgoing(userId: string, limit: number) {
    return this.db.teamChallenge.findMany({
      where: {
        OR: [
          { challengerTeam: { OR: this.capabilityTeamFilters(userId, "CREATE_CHALLENGE") } },
          {
            status: "ACCEPTED",
            challengerTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") }
          }
        ]
      },
      include: { challengerTeam: true, challengedTeam: true, game: true },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async acceptChallenge(challengeId: string) {
    return this.db.$transaction(async (tx) => {
      const challenge = await tx.teamChallenge.update({
        where: { id: challengeId },
        data: { status: "ACCEPTED" }
      });
      await tx.teamGame.create({
        data: {
          challengeId: challenge.id,
          homeTeamId: challenge.challengerTeamId,
          awayTeamId: challenge.challengedTeamId,
          scheduledAt: challenge.proposedAt,
          status: challenge.proposedAt ? "CONFIRMED" : "SCHEDULING"
        }
      });
      return challenge;
    });
  }

  declineChallenge(challengeId: string) {
    return this.db.teamChallenge.update({
      where: { id: challengeId },
      data: { status: "DECLINED" }
    });
  }

  cancelChallenge(challengeId: string) {
    return this.db.teamChallenge.update({
      where: { id: challengeId },
      data: { status: "CANCELLED" }
    });
  }

  listMessages(challengeId: string) {
    return this.db.teamChallengeMessage.findMany({
      where: { challengeId },
      include: { author: { select: { presentation: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  createMessage(challengeId: string, userId: string, body: string) {
    return this.db.teamChallengeMessage.create({
      data: { challengeId, authorUserId: userId, body }
    });
  }

  listGames(userId: string, limit: number) {
    return this.db.teamGame.findMany({
      where: {
        OR: [
          { homeTeam: { OR: this.managedTeamFilters(userId) } },
          { awayTeam: { OR: this.managedTeamFilters(userId) } }
        ]
      },
      include: { homeTeam: true, awayTeam: true, challenge: true },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: limit
    });
  }

  getGame(gameId: string, userId: string) {
    return this.db.teamGame.findFirst({
      where: {
        id: gameId,
        OR: [
          { homeTeam: { OR: this.managedTeamFilters(userId) } },
          { awayTeam: { OR: this.managedTeamFilters(userId) } }
        ]
      },
      include: { homeTeam: true, awayTeam: true, challenge: true }
    });
  }

  private managedTeamFilters(userId: string): Prisma.TeamWhereInput[] {
    return [
      { responsibilities: { some: { userId, revokedAt: null } } },
      {
        community: {
          memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } }
        }
      }
    ];
  }

  private capabilityTeamFilters(
    userId: string,
    capability: TeamCapabilityInput
  ): Prisma.TeamWhereInput[] {
    return [
      { responsibilities: { some: { userId, role: "COACH", revokedAt: null } } },
      {
        AND: [
          { responsibilities: { some: { userId, role: "ASSISTANT", revokedAt: null } } },
          { capabilityGrants: { some: { userId, capability, revokedAt: null } } }
        ]
      },
      {
        community: {
          memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } }
        }
      }
    ];
  }

  private challengeViewFilters(userId: string): Prisma.TeamChallengeWhereInput[] {
    return [
      { challengerTeam: { OR: this.capabilityTeamFilters(userId, "CREATE_CHALLENGE") } },
      { challengedTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") } },
      {
        status: "ACCEPTED",
        challengerTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") }
      }
    ];
  }
}
