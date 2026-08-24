import type { Prisma, PrismaClient } from "@hooma/database";
import type { TeamLifecycleRepository } from "../application/team-lifecycle.repository.js";

const offerSelect = {
  id: true,
  teamId: true,
  targetUserId: true,
  offeredByUserId: true,
  message: true,
  status: true,
  createdAt: true,
  respondedAt: true,
} satisfies Prisma.TeamPlayerOfferSelect;

export class PrismaTeamLifecycleRepository implements TeamLifecycleRepository {
  constructor(private readonly db: PrismaClient) {}

  get(teamId: string) {
    return this.db.team.findUnique({
      where: { id: teamId },
      select: { createdByUserId: true, status: true },
    });
  }

  async isActive(teamId: string): Promise<boolean> {
    return Boolean(
      await this.db.team.findFirst({
        where: { id: teamId, status: "ACTIVE" },
        select: { id: true },
      }),
    );
  }

  listRecruitingTeams(userId: string) {
    return this.db.team.findMany({
      where: {
        status: "ACTIVE",
        OR: this.capabilityTeamFilters(userId, "MANAGE_ROSTER"),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        badgeUrl: true,
        city: true,
        houma: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async resolvePlayerOfferTarget(listingId: string): Promise<string | null> {
    const listing = await this.db.playPlayerListing.findFirst({
      where: { id: listingId, lookingFor: "TEAM" },
      select: { userId: true },
    });
    return listing?.userId ?? null;
  }

  async isActivePlayer(teamId: string, targetUserId: string): Promise<boolean> {
    return Boolean(
      await this.db.teamPlayer.findFirst({
        where: { teamId, userId: targetUserId, active: true, leftAt: null },
        select: { id: true },
      }),
    );
  }

  upsertPlayerOffer(
    teamId: string,
    targetUserId: string,
    offeredByUserId: string,
    message: string | null,
  ) {
    return this.db.teamPlayerOffer.upsert({
      where: { teamId_targetUserId: { teamId, targetUserId } },
      create: { teamId, targetUserId, offeredByUserId, message },
      update: {
        offeredByUserId,
        message,
        status: "PENDING",
        respondedAt: null,
        createdAt: new Date(),
      },
      include: {
        team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
      },
    });
  }

  listIncomingPlayerOffers(targetUserId: string) {
    return this.db.teamPlayerOffer.findMany({
      where: { targetUserId, status: "PENDING", team: { status: "ACTIVE" } },
      include: {
        team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  getPlayerOfferForTarget(offerId: string, targetUserId: string) {
    return this.db.teamPlayerOffer.findFirst({
      where: { id: offerId, targetUserId },
      select: offerSelect,
    });
  }

  async acceptPlayerOffer(offerId: string, targetUserId: string) {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.teamPlayerOffer.updateMany({
        where: { id: offerId, targetUserId, status: "PENDING", team: { status: "ACTIVE" } },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      if (changed.count !== 1) return null;

      const offer = await tx.teamPlayerOffer.findUniqueOrThrow({
        where: { id: offerId },
        select: { teamId: true },
      });
      await tx.teamPlayer.upsert({
        where: { teamId_userId: { teamId: offer.teamId, userId: targetUserId } },
        create: { teamId: offer.teamId, userId: targetUserId },
        update: { leftAt: null, active: true, joinedAt: new Date() },
      });

      return tx.teamPlayerOffer.findUnique({
        where: { id: offerId },
        include: {
          team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
        },
      });
    });
  }

  async declinePlayerOffer(offerId: string, targetUserId: string) {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.teamPlayerOffer.updateMany({
        where: { id: offerId, targetUserId, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      return tx.teamPlayerOffer.findUnique({
        where: { id: offerId },
        include: {
          team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
        },
      });
    });
  }

  async archive(teamId: string): Promise<void> {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.team.update({ where: { id: teamId }, data: { status: "ARCHIVED" } });
      await tx.teamPlayer.updateMany({
        where: { teamId, leftAt: null, active: true },
        data: { leftAt: now, active: false },
      });
      await tx.teamResponsibilityAssignment.updateMany({
        where: { teamId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.teamLineup.updateMany({
        where: { teamId, active: true },
        data: { active: false, isCurrent: false },
      });
      await tx.teamPlayerOffer.updateMany({
        where: { teamId, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: now },
      });
      await tx.teamChallenge.updateMany({
        where: {
          status: "PENDING",
          OR: [{ challengerTeamId: teamId }, { challengedTeamId: teamId }],
        },
        data: { status: "CANCELLED" },
      });
      await tx.teamGame.updateMany({
        where: {
          status: { in: ["SCHEDULING", "CONFIRMED"] },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        data: { status: "CANCELLED" },
      });
    });
  }

  private capabilityTeamFilters(
    userId: string,
    capability: "MANAGE_ROSTER",
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
}
