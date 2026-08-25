import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput,
} from "@hooma/contracts";
import type {
  TeamAccessRecord,
  TeamListInput,
  TeamRepository,
} from "../application/team.repository.js";

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "team"
  );
}

function teamCreateData(
  userId: string,
  input: TeamCreateInput,
  slug: string,
): Prisma.TeamUncheckedCreateInput {
  return {
    communityId: input.communityId,
    name: input.name,
    slug,
    createdByUserId: userId,
    ...(input.motto !== undefined ? { motto: input.motto } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.badgeUrl !== undefined ? { badgeUrl: input.badgeUrl } : {}),
    ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
  };
}

function teamUpdateData(input: TeamUpdateInput): Prisma.TeamUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.motto !== undefined ? { motto: input.motto } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.badgeUrl !== undefined ? { badgeUrl: input.badgeUrl } : {}),
    ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
  };
}

function lineupSlots(input: TeamLineupInput) {
  return input.slots.map((slot) => ({
    teamPlayerId: slot.teamPlayerId ?? null,
    position: slot.position,
    x: slot.x,
    y: slot.y,
    isStarter: slot.isStarter,
    sortOrder: slot.sortOrder,
  }));
}

const lineupSelect = {
  id: true,
  name: true,
  formation: true,
  matchFormat: true,
  published: true,
  isCurrent: true,
  updatedAt: true,
  slots: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      teamPlayerId: true,
      position: true,
      x: true,
      y: true,
      isStarter: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.TeamLineupSelect;

const teamSummarySelect = {
  id: true,
  slug: true,
  name: true,
  motto: true,
  city: true,
  houma: true,
  badgeUrl: true,
  bannerUrl: true,
  communityId: true,
  _count: { select: { players: { where: { leftAt: null, active: true } } } },
} satisfies Prisma.TeamSelect;

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
                { houma: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(input.city ? { city: { contains: input.city.trim(), mode: "insensitive" } } : {}),
        ...(input.houma ? { houma: { contains: input.houma.trim(), mode: "insensitive" } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: teamSummarySelect,
    });
    return {
      items: rows.slice(0, input.limit),
      nextCursor: rows.length > input.limit ? (rows[input.limit - 1]?.id ?? null) : null,
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
        bannerUrl: true,
        community: { select: { id: true, name: true, slug: true } },
        players: {
          where: { leftAt: null, active: true },
          select: {
            id: true,
            userId: true,
            joinedAt: true,
            user: { select: { presentation: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        responsibilities: {
          where: { revokedAt: null },
          select: { userId: true, role: true, user: { select: { presentation: true } } },
        },
        lineups: {
          where: { published: true, active: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: lineupSelect,
        },
      },
    });
  }

  listMine(userId: string) {
    return this.db.team.findMany({
      where: {
        status: "ACTIVE",
        players: { some: { userId, leftAt: null, active: true } },
      },
      select: teamSummarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
        bannerUrl: true,
        communityId: true,
        city: true,
        houma: true,
      },
      orderBy: { name: "asc" },
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
          select: { memberships: { where: { userId, leftAt: null }, select: { role: true } } },
        },
      },
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
      communityRole: team.community?.memberships[0]?.role ?? null,
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
      await tx.teamResponsibilityAssignment.create({
        data: { teamId: team.id, userId, role: "COACH" },
      });
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
      update: { leftAt: null, joinedAt: new Date(), active: true },
    });
  }

  async removePlayer(teamId: string, targetUserId: string): Promise<number> {
    return (
      await this.db.teamPlayer.updateMany({
        where: { teamId, userId: targetUserId, leftAt: null },
        data: { leftAt: new Date(), active: false },
      })
    ).count;
  }

  async assignAssistant(
    teamId: string,
    targetUserId: string,
    capabilities: readonly TeamCapabilityInput[],
    coachUserId: string,
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamPlayer.upsert({
        where: { teamId_userId: { teamId, userId: targetUserId } },
        create: { teamId, userId: targetUserId },
        update: { leftAt: null, active: true },
      });

      const activeAssistant = await tx.teamResponsibilityAssignment.findFirst({
        where: { teamId, userId: targetUserId, role: "ASSISTANT", revokedAt: null },
        select: { id: true },
      });
      if (!activeAssistant) {
        await tx.teamResponsibilityAssignment.create({
          data: { teamId, userId: targetUserId, role: "ASSISTANT" },
        });
      }

      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      for (const capability of capabilities) {
        await tx.teamCapabilityGrant.upsert({
          where: { teamId_userId_capability: { teamId, userId: targetUserId, capability } },
          create: {
            teamId,
            userId: targetUserId,
            capability,
            grantedBy: coachUserId,
          },
          update: {
            revokedAt: null,
            grantedBy: coachUserId,
          },
        });
      }
    });
  }

  async revokeAssistant(teamId: string, targetUserId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.teamResponsibilityAssignment.updateMany({
        where: { teamId, userId: targetUserId, role: "ASSISTANT", revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async listActivePlayerIds(teamId: string): Promise<string[]> {
    const rows = await this.db.teamPlayer.findMany({
      where: { teamId, leftAt: null, active: true },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  getCurrentLineup(teamId: string) {
    return this.db.teamLineup.findFirst({
      where: { teamId, isCurrent: true, active: true },
      select: lineupSelect,
    });
  }

  async saveCurrentLineup(userId: string, teamId: string, input: TeamLineupInput) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.teamLineup.findFirst({
        where: { teamId, isCurrent: true, active: true },
        select: { id: true, published: true },
      });

      const updateExisting = current && (!current.published || input.published);
      if (updateExisting) {
        await tx.teamLineupSlot.deleteMany({ where: { lineupId: current.id } });
        return tx.teamLineup.update({
          where: { id: current.id },
          data: {
            name: input.name,
            formation: input.formation,
            matchFormat: input.matchFormat,
            published: input.published,
            slots: { create: lineupSlots(input) },
          },
          select: lineupSelect,
        });
      }

      if (current) {
        await tx.teamLineup.update({ where: { id: current.id }, data: { isCurrent: false } });
      }

      return tx.teamLineup.create({
        data: {
          teamId,
          name: input.name,
          formation: input.formation,
          matchFormat: input.matchFormat,
          published: input.published,
          isCurrent: true,
          createdByUserId: userId,
          slots: { create: lineupSlots(input) },
        },
        select: lineupSelect,
      });
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
        ...(input.message !== undefined ? { message: input.message } : {}),
      },
    });
  }

  getChallenge(challengeId: string) {
    return this.db.teamChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, challengerTeamId: true, challengedTeamId: true, status: true },
    });
  }

  getChallengeForUser(challengeId: string, userId: string) {
    return this.db.teamChallenge.findFirst({
      where: { id: challengeId, OR: this.challengeViewFilters(userId) },
      include: { challengerTeam: true, challengedTeam: true, game: true },
    });
  }

  listIncoming(userId: string, limit: number) {
    return this.db.teamChallenge.findMany({
      where: {
        challengedTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") },
      },
      include: { challengerTeam: true, challengedTeam: true, game: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  listOutgoing(userId: string, limit: number) {
    return this.db.teamChallenge.findMany({
      where: {
        OR: [
          { challengerTeam: { OR: this.capabilityTeamFilters(userId, "CREATE_CHALLENGE") } },
          {
            status: "ACCEPTED",
            challengerTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") },
          },
        ],
      },
      include: { challengerTeam: true, challengedTeam: true, game: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async acceptChallenge(challengeId: string) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.teamChallenge.findUnique({ where: { id: challengeId } });
      if (!existing) return null;
      if (existing.status === "ACCEPTED") {
        await tx.teamGame.upsert({
          where: { challengeId },
          create: {
            challengeId,
            homeTeamId: existing.challengerTeamId,
            awayTeamId: existing.challengedTeamId,
            scheduledAt: existing.proposedAt,
            status: existing.proposedAt ? "CONFIRMED" : "SCHEDULING",
          },
          update: {},
        });
        return existing;
      }
      if (existing.status !== "PENDING") return null;

      const transitioned = await tx.teamChallenge.updateMany({
        where: { id: challengeId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (transitioned.count !== 1) {
        const current = await tx.teamChallenge.findUnique({ where: { id: challengeId } });
        if (current?.status !== "ACCEPTED") return null;
        await tx.teamGame.upsert({
          where: { challengeId },
          create: {
            challengeId,
            homeTeamId: current.challengerTeamId,
            awayTeamId: current.challengedTeamId,
            scheduledAt: current.proposedAt,
            status: current.proposedAt ? "CONFIRMED" : "SCHEDULING",
          },
          update: {},
        });
        return current;
      }

      const challenge = await tx.teamChallenge.findUniqueOrThrow({ where: { id: challengeId } });
      await tx.teamGame.upsert({
        where: { challengeId },
        create: {
          challengeId: challenge.id,
          homeTeamId: challenge.challengerTeamId,
          awayTeamId: challenge.challengedTeamId,
          scheduledAt: challenge.proposedAt,
          status: challenge.proposedAt ? "CONFIRMED" : "SCHEDULING",
        },
        update: {},
      });
      return challenge;
    });
  }

  async declineChallenge(challengeId: string) {
    const transitioned = await this.db.teamChallenge.updateMany({
      where: { id: challengeId, status: "PENDING" },
      data: { status: "DECLINED" },
    });
    if (transitioned.count === 1) {
      return this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    }
    const current = await this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    return current?.status === "DECLINED" ? current : null;
  }

  async cancelChallenge(challengeId: string) {
    const transitioned = await this.db.teamChallenge.updateMany({
      where: { id: challengeId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (transitioned.count === 1) {
      return this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    }
    const current = await this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    return current?.status === "CANCELLED" ? current : null;
  }

  listMessages(challengeId: string) {
    return this.db.teamChallengeMessage.findMany({
      where: { challengeId },
      include: { author: { select: { presentation: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  createMessage(challengeId: string, userId: string, body: string) {
    return this.db.teamChallengeMessage.create({
      data: { challengeId, authorUserId: userId, body },
    });
  }

  listGames(userId: string, limit: number) {
    return this.db.teamGame.findMany({
      where: {
        OR: [
          { homeTeam: { OR: this.managedTeamFilters(userId) } },
          { awayTeam: { OR: this.managedTeamFilters(userId) } },
        ],
      },
      include: { homeTeam: true, awayTeam: true, challenge: true },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  getGame(gameId: string, userId: string) {
    return this.db.teamGame.findFirst({
      where: {
        id: gameId,
        OR: [
          { homeTeam: { OR: this.managedTeamFilters(userId) } },
          { awayTeam: { OR: this.managedTeamFilters(userId) } },
        ],
      },
      include: { homeTeam: true, awayTeam: true, challenge: true },
    });
  }

  private managedTeamFilters(userId: string): Prisma.TeamWhereInput[] {
    return [
      { responsibilities: { some: { userId, revokedAt: null } } },
      {
        community: {
          memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } },
        },
      },
    ];
  }

  private capabilityTeamFilters(
    userId: string,
    capability: TeamCapabilityInput,
  ): Prisma.TeamWhereInput[] {
    return [
      { responsibilities: { some: { userId, role: "COACH", revokedAt: null } } },
      {
        AND: [
          { responsibilities: { some: { userId, role: "ASSISTANT", revokedAt: null } } },
          { capabilityGrants: { some: { userId, capability, revokedAt: null } } },
        ],
      },
      {
        community: {
          memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } },
        },
      },
    ];
  }

  private challengeViewFilters(userId: string): Prisma.TeamChallengeWhereInput[] {
    return [
      { challengerTeam: { OR: this.capabilityTeamFilters(userId, "CREATE_CHALLENGE") } },
      { challengedTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") } },
      {
        status: "ACCEPTED",
        challengerTeam: { OR: this.capabilityTeamFilters(userId, "RESPOND_TO_CHALLENGE") },
      },
    ];
  }
}
