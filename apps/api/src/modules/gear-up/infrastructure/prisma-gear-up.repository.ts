import type {
  GearUpListQueryInput,
  GearUpReviewQueueItem,
  GearUpShopSuggestionInput,
  GearUpShopUpdateInput,
  ManagedGearUpShop,
  PublicGearUpShop,
} from "@hooma/contracts/gear-up";
import type { PlaceSuggestionResult } from "@hooma/contracts/places";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  GearUpModerationDecision,
  GearUpRepository,
} from "../application/gear-up.repository.js";
import {
  canonicalPlaceSelect,
  canonicalPlaceSummary,
  groupCanonicalPlaceImages,
  suggestCanonicalPlace,
} from "../../places/boundary/canonical-place.persistence.js";

const publicShopSelect = Prisma.validator<Prisma.GearUpShopSelect>()({
  placeId: true,
  offerTypes: true,
  sports: true,
  categories: true,
  paymentMethods: true,
  moderationStatus: true,
  reviewedAt: true,
  reviewNote: true,
  place: {
    select: {
      ...canonicalPlaceSelect,
      moderationStatus: true,
      archivedAt: true,
      createdAt: true,
      suggestedBy: {
        select: {
          id: true,
          presentation: { select: { username: true, displayName: true } },
        },
      },
      ownerships: {
        where: { revokedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  },
});

type GearUpShopRow = Prisma.GearUpShopGetPayload<{ select: typeof publicShopSelect }>;

function publicShop(
  row: GearUpShopRow,
  images: readonly {
    id: string;
    placeId: string;
    imageUrl: string;
    sortOrder: number;
  }[],
): PublicGearUpShop {
  return {
    place: canonicalPlaceSummary(row.place, images),
    offerTypes: row.offerTypes,
    sports: row.sports,
    categories: row.categories,
    paymentMethods: row.paymentMethods,
    verifiedOwner: row.place.ownerships.length > 0,
  };
}

export class PrismaGearUpRepository implements GearUpRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: GearUpListQueryInput) {
    const q = input.q?.trim();
    const rows = await this.db.gearUpShop.findMany({
      where: {
        moderationStatus: "APPROVED",
        ...(input.offer ? { offerTypes: { has: input.offer } } : {}),
        ...(input.sport ? { sports: { has: input.sport } } : {}),
        ...(input.category ? { categories: { has: input.category } } : {}),
        place: {
          moderationStatus: "APPROVED",
          archivedAt: null,
          discoveries: { some: { kind: "GEAR_UP" } },
          ...(input.source ? { submissionOrigin: input.source } : {}),
          ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
          ...(input.houma ? { houma: { equals: input.houma, mode: "insensitive" } } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { address: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      },
      select: publicShopSelect,
      orderBy: [{ updatedAt: "desc" }, { placeId: "asc" }],
      take: input.limit,
    });
    const images = await this.images(rows.map((row) => row.placeId));
    return rows.map((row) => publicShop(row, images.get(row.placeId) ?? []));
  }

  async getPublic(placeId: string) {
    const row = await this.db.gearUpShop.findFirst({
      where: {
        placeId,
        moderationStatus: "APPROVED",
        place: {
          moderationStatus: "APPROVED",
          archivedAt: null,
          discoveries: { some: { kind: "GEAR_UP" } },
        },
      },
      select: publicShopSelect,
    });
    if (!row) return null;
    const images = await this.images([placeId]);
    return publicShop(row, images.get(placeId) ?? []);
  }

  async suggest(userId: string, input: GearUpShopSuggestionInput): Promise<PlaceSuggestionResult> {
    return this.db.$transaction(async (tx) => {
      const place = await suggestCanonicalPlace(
        tx,
        userId,
        input.place,
        input.place.submissionOrigin,
        "GEAR_UP",
      );
      await tx.gearUpShop.upsert({
        where: { placeId: place.place.id },
        create: {
          placeId: place.place.id,
          offerTypes: input.shop.offerTypes,
          sports: input.shop.sports,
          categories: input.shop.categories,
          paymentMethods: input.shop.paymentMethods,
        },
        update: {},
      });
      return place;
    });
  }

  async getManaged(placeId: string): Promise<ManagedGearUpShop | null> {
    const row = await this.db.gearUpShop.findUnique({
      where: { placeId },
      select: publicShopSelect,
    });
    if (!row) return null;
    const images = await this.images([placeId]);
    return {
      ...publicShop(row, images.get(placeId) ?? []),
      moderationStatus: row.moderationStatus,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
    };
  }

  async updateShop(placeId: string, input: GearUpShopUpdateInput) {
    await this.db.gearUpShop.update({
      where: { placeId },
      data: {
        ...(input.offerTypes !== undefined ? { offerTypes: input.offerTypes } : {}),
        ...(input.sports !== undefined ? { sports: input.sports } : {}),
        ...(input.categories !== undefined ? { categories: input.categories } : {}),
        ...(input.paymentMethods !== undefined ? { paymentMethods: input.paymentMethods } : {}),
      },
    });
    return this.getManaged(placeId);
  }

  async pending(): Promise<readonly GearUpReviewQueueItem[]> {
    const rows = await this.db.gearUpShop.findMany({
      where: {
        moderationStatus: "PENDING",
        place: { archivedAt: null },
      },
      select: publicShopSelect,
      orderBy: [{ createdAt: "asc" }, { placeId: "asc" }],
    });
    const images = await this.images(rows.map((row) => row.placeId));
    return rows
      .filter((row) => row.place.suggestedBy.presentation)
      .map((row) => ({
        placeId: row.placeId,
        status: row.moderationStatus,
        createdAt: row.place.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.place.suggestedBy.id,
          username: row.place.suggestedBy.presentation!.username,
          displayName: row.place.suggestedBy.presentation!.displayName,
        },
        shop: publicShop(row, images.get(row.placeId) ?? []),
      }));
  }

  async review(
    actorUserId: string,
    placeId: string,
    input: GearUpModerationDecision,
  ): Promise<boolean> {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const target = await tx.gearUpShop.findFirst({
        where: { placeId, moderationStatus: "PENDING", place: { archivedAt: null } },
        select: { place: { select: { moderationStatus: true } } },
      });
      if (!target) return false;

      if (target.place.moderationStatus === "PENDING") {
        const placeResult = await tx.place.updateMany({
          where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
          data: {
            moderationStatus: status,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
            reviewNote: input.note ?? null,
          },
        });
        if (!placeResult.count) return false;
      }

      const reviewedAt = new Date();
      const shopResult = await tx.gearUpShop.updateMany({
        where: { placeId, moderationStatus: "PENDING" },
        data: {
          moderationStatus: status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!shopResult.count) return false;

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `GEAR_UP_SHOP_${status}`,
          entityType: "GearUpShop",
          entityId: placeId,
          metadata: { note: input.note ?? null },
        },
      });
      return true;
    });
  }

  private async images(placeIds: readonly string[]) {
    if (!placeIds.length) return new Map();
    const rows = await this.db.placeImage.findMany({
      where: { placeId: { in: [...placeIds] } },
      orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    return groupCanonicalPlaceImages(rows);
  }
}
