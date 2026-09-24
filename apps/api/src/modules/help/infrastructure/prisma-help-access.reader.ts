import type { PrismaClient } from "@hooma/database";
import type { HelpAccessReader } from "../application/help-access.reader.js";

export class PrismaHelpAccessReader implements HelpAccessReader {
  constructor(private readonly db: PrismaClient) {}

  async communityRole(communityId: string, userId: string) {
    const membership = await this.db.communityMembership.findFirst({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async teamResponsibility(teamId: string, userId: string) {
    const assignments = await this.db.teamResponsibilityAssignment.findMany({
      where: { teamId, userId, revokedAt: null, team: { status: "ACTIVE" } },
      select: { role: true },
    });
    if (assignments.some((assignment) => assignment.role === "COACH")) return "COACH" as const;
    if (assignments.some((assignment) => assignment.role === "ASSISTANT"))
      return "ASSISTANT" as const;
    return null;
  }

  async athletesRole(athletesCommunityId: string, userId: string) {
    const membership = await this.db.athletesMembership.findFirst({
      where: {
        athletesCommunityId,
        userId,
        leftAt: null,
        athletesCommunity: { status: "ACTIVE" },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async isCommunityMember(communityId: string, userId: string): Promise<boolean> {
    return Boolean(await this.communityRole(communityId, userId));
  }

  async isAthletesMember(athletesCommunityId: string, userId: string): Promise<boolean> {
    return Boolean(await this.athletesRole(athletesCommunityId, userId));
  }
}
