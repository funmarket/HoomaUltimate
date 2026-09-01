import { type Prisma, type PrismaClient } from "@hooma/database";
import type {
  RideCommunityMembershipReader,
  RideCommunitySummary,
} from "../application/ride-community-membership.reader.js";
import type {
  RideDestinationEventReference,
  RideDestinationPlaceReference,
  RideEventReferenceReader,
  RidePlaceReferenceReader,
} from "../application/ride-reference.readers.js";

export class PrismaRideReferenceReader
  implements RideEventReferenceReader, RidePlaceReferenceReader, RideCommunityMembershipReader
{
  constructor(private readonly db: PrismaClient) {}

  async resolveRideDestinationEvent(
    eventId: string,
  ): Promise<RideDestinationEventReference | null> {
    const event = await this.db.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, startsAt: true, status: true },
    });

    return event;
  }

  async resolveRideDestinationPlace(
    placeId: string,
  ): Promise<RideDestinationPlaceReference | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED", archivedAt: null },
      select: { id: true, name: true, city: true, houma: true },
    });
    if (!place) return null;

    return { ...place, status: "APPROVED" };
  }

  async listActiveMembershipCommunities(userId: string): Promise<RideCommunitySummary[]> {
    return activeMembershipCommunities(this.db, userId);
  }

  async isActiveMemberOfCommunity(userId: string, communityId: string): Promise<boolean> {
    const membership = await this.db.communityMembership.findFirst({
      where: { userId, communityId, leftAt: null, community: { status: "ACTIVE" } },
      select: { communityId: true },
    });
    return membership !== null;
  }
}

export async function activeMembershipCommunities(
  db: Prisma.TransactionClient | PrismaClient,
  userId: string,
): Promise<RideCommunitySummary[]> {
  const rows = await db.communityMembership.findMany({
    where: { userId, leftAt: null, community: { status: "ACTIVE" } },
    orderBy: [{ joinedAt: "asc" }, { communityId: "asc" }],
    select: { community: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map((row) => row.community);
}

export async function isActiveCommunityMember(
  db: Prisma.TransactionClient | PrismaClient,
  userId: string,
  communityId: string,
): Promise<boolean> {
  const membership = await db.communityMembership.findFirst({
    where: { userId, communityId, leftAt: null, community: { status: "ACTIVE" } },
    select: { communityId: true },
  });
  return membership !== null;
}
