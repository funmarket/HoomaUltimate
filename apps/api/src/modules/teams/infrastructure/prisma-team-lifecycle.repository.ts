import type { PrismaClient } from "@hooma/database";
import type { TeamLifecycleRepository } from "../application/team-lifecycle.repository.js";

export class PrismaTeamLifecycleRepository implements TeamLifecycleRepository {
  constructor(private readonly db: PrismaClient) {}

  get(teamId: string) {
    return this.db.team.findUnique({
      where: { id: teamId },
      select: { createdByUserId: true, status: true }
    });
  }

  async isActive(teamId: string): Promise<boolean> {
    return Boolean(
      await this.db.team.findFirst({
        where: { id: teamId, status: "ACTIVE" },
        select: { id: true }
      })
    );
  }

  async archive(teamId: string): Promise<void> {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.team.update({ where: { id: teamId }, data: { status: "ARCHIVED" } });
      await tx.teamPlayer.updateMany({
        where: { teamId, leftAt: null, active: true },
        data: { leftAt: now, active: false }
      });
      await tx.teamResponsibilityAssignment.updateMany({
        where: { teamId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.teamCapabilityGrant.updateMany({
        where: { teamId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.teamLineup.updateMany({
        where: { teamId, active: true },
        data: { active: false, isCurrent: false }
      });
      await tx.teamChallenge.updateMany({
        where: {
          status: "PENDING",
          OR: [{ challengerTeamId: teamId }, { challengedTeamId: teamId }]
        },
        data: { status: "CANCELLED" }
      });
      await tx.teamGame.updateMany({
        where: {
          status: { in: ["SCHEDULING", "CONFIRMED"] },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
        },
        data: { status: "CANCELLED" }
      });
    });
  }
}
