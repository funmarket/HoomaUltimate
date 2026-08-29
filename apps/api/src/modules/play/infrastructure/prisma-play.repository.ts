import type { PrismaClient } from "@hooma/database";
import type { PlayLookingFor, PlayPlayerListingInput } from "@hooma/contracts/play";
import type { PlayPlayerListingRepository } from "../application/play.repository.js";

const publicProjection = {
  id: true,
  lookingFor: true,
  updatedAt: true,
  user: {
    select: {
      presentation: {
        select: {
          username: true,
          displayName: true,
          photoUrl: true,
          bio: true,
        },
      },
    },
  },
} as const;

export class PrismaPlayPlayerListingRepository implements PlayPlayerListingRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(limit: number) {
    const rows = await this.db.playPlayerListing.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: publicProjection,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        lookingFor: row.lookingFor,
        updatedAt: row.updatedAt,
        presentation: row.user.presentation,
      })),
    };
  }

  getMine(userId: string) {
    return this.db.playPlayerListing.findUnique({
      where: { userId },
      select: { id: true, lookingFor: true, createdAt: true, updatedAt: true },
    });
  }

  saveMine(userId: string, input: PlayPlayerListingInput) {
    return this.db.playPlayerListing.upsert({
      where: { userId },
      create: { userId, lookingFor: input.lookingFor },
      update: { lookingFor: input.lookingFor },
      select: { id: true, lookingFor: true, createdAt: true, updatedAt: true },
    });
  }

  async removeMine(userId: string): Promise<boolean> {
    const result = await this.db.playPlayerListing.deleteMany({ where: { userId } });
    return result.count > 0;
  }

  resolveTarget(listingId: string, lookingFor: PlayLookingFor) {
    return this.db.playPlayerListing
      .findFirst({
        where: { id: listingId, lookingFor },
        select: { id: true, userId: true },
      })
      .then((listing) => (listing ? { listingId: listing.id, userId: listing.userId } : null));
  }

  async listByUserIds(userIds: string[], lookingFor: PlayLookingFor) {
    if (!userIds.length) return [];
    const listings = await this.db.playPlayerListing.findMany({
      where: { userId: { in: userIds }, lookingFor },
      select: { id: true, userId: true },
    });
    return listings.map((listing) => ({
      listingId: listing.id,
      userId: listing.userId,
    }));
  }
}
