import type { PrismaClient } from "@hooma/database";
import type {
  RideCommunityInteractionRecord,
  RideCommunityInteractionRepository,
} from "../application/ride-community-interaction.repository.js";

export class PrismaRideCommunityInteractionRepository
  implements RideCommunityInteractionRepository
{
  constructor(private readonly db: PrismaClient) {}

  async getActiveCommunityRequest(input: {
    readonly communityId: string;
    readonly requestId: string;
  }): Promise<RideCommunityInteractionRecord | null> {
    const row = await this.db.rideRequest.findFirst({
      where: {
        id: input.requestId,
        audienceScope: "COMMUNITY",
        status: "OPEN",
        expiresAt: { gt: new Date() },
        communityAudiences: { some: { communityId: input.communityId } },
        requester: {
          communityMemberships: {
            some: {
              communityId: input.communityId,
              leftAt: null,
              community: { status: "ACTIVE" },
            },
          },
        },
      },
      select: { requesterUserId: true },
    });

    return row ? { requesterUserId: row.requesterUserId } : null;
  }
}
