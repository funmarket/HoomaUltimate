import {
  PLACE_IMAGE_RECONCILE_TOPIC,
  placeImageObjectKey,
  placeManagedImagePath,
} from "@hooma/contracts/places";
import type {
  ManagedPlaceSummary,
  PlaceOwnershipClaimInput,
  PlaceOwnershipReviewQueueItem,
  PlaceReviewQueueItem,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceImage,
  PublicPlaceSummary,
} from "@hooma/contracts/places";
import { Prisma, type PrismaClient } from "@hooma/database";
import type { PlaceModerationDecision, PlaceRepository } from "../application/place.repository.js";
import {
  canonicalPlaceSelect,
  canonicalPlaceSummary,
  findCanonicalPlaceDuplicate,
  groupCanonicalPlaceImages,
  lockCanonicalPlaceIdentity,
  suggestCanonicalPlace,
} from "../boundary/canonical-place.persistence.js";

type PlaceIdentityInput = Pick<
  PlaceSuggestionInput,
  "name" | "address" | "phone" | "websiteUrl" | "latitude" | "longitude"
>;

function menuCreate(input: PlaceSuggestionInput["menuItems"]) {
  return input.map((item, index) => ({
    name: item.name,
    price: new Prisma.Decimal(item.price),
    currency: item.currency.toUpperCase(),
    sortOrder: index,
  }));
}

export class PrismaPlaceRepository implements PlaceRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(): Promise<readonly PublicPlaceSummary[]> {
    const places = await this.db.place.findMany({
      where: {
        moderationStatus: "APPROVED",
        archivedAt: null,
        discoveries: { some: { kind: "WATCH_SPOT" } },
      },
      select: canonicalPlaceSelect,
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
    const images = places.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: places.map((place) => place.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupCanonicalPlaceImages(images);
    return places.map((place) => canonicalPlaceSummary(place, byPlace.get(place.id) ?? []));
  }

  async suggest(userId: string, input: PlaceSuggestionInput): Promise<PlaceSuggestionResult> {
    return this.db.$transaction((tx) =>
      suggestCanonicalPlace(tx, userId, input, input.submissionOrigin, "WATCH_SPOT"),
    );
  }

  async getApproved(placeId: string): Promise<PublicPlaceSummary | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED", archivedAt: null },
      select: canonicalPlaceSelect,
    });
    if (!place) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return canonicalPlaceSummary(place, images);
  }

  async getManaged(placeId: string): Promise<ManagedPlaceSummary | null> {
    const place = await this.db.place.findUnique({
      where: { id: placeId },
      select: { ...canonicalPlaceSelect, moderationStatus: true, archivedAt: true },
    });
    if (!place) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return {
      ...canonicalPlaceSummary(place, images),
      moderationStatus: place.moderationStatus,
      archivedAt: place.archivedAt?.toISOString() ?? null,
    };
  }

  async canManage(placeId: string, userId: string): Promise<boolean> {
    const place = await this.db.place.findUnique({
      where: { id: placeId },
      select: {
        suggestedByUserId: true,
        moderationStatus: true,
        ownerships: { where: { userId, revokedAt: null }, select: { id: true }, take: 1 },
      },
    });
    if (!place) return false;
    if (place.ownerships.length) return true;
    if (place.suggestedByUserId !== userId) return false;
    return place.moderationStatus === "PENDING";
  }

  async update(placeId: string, input: PlaceUpdateInput): Promise<ManagedPlaceSummary> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.place.findUniqueOrThrow({
        where: { id: placeId },
        select: {
          name: true,
          address: true,
          phone: true,
          websiteUrl: true,
          latitude: true,
          longitude: true,
        },
      });
      const identity: PlaceIdentityInput = {
        name: input.name ?? current.name,
        address: input.address ?? current.address,
        phone: input.phone === undefined ? current.phone : input.phone,
        websiteUrl: input.websiteUrl === undefined ? current.websiteUrl : input.websiteUrl,
        latitude:
          input.latitude === undefined ? (current.latitude?.toNumber() ?? null) : input.latitude,
        longitude:
          input.longitude === undefined ? (current.longitude?.toNumber() ?? null) : input.longitude,
      };
      const identityChanged =
        identity.name !== current.name ||
        identity.address !== current.address ||
        identity.phone !== current.phone ||
        identity.websiteUrl !== current.websiteUrl ||
        identity.latitude !== (current.latitude?.toNumber() ?? null) ||
        identity.longitude !== (current.longitude?.toNumber() ?? null);
      if (identityChanged) {
        await lockCanonicalPlaceIdentity(tx, identity);
        if (await findCanonicalPlaceDuplicate(tx, identity, placeId)) {
          throw new Error("PLACE_ALREADY_EXISTS");
        }
      }

      if (input.menuItems !== undefined) {
        await tx.placeMenuItem.deleteMany({ where: { placeId } });
      }
      const place = await tx.place.update({
        where: { id: placeId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.houma !== undefined ? { houma: input.houma } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.menuItems !== undefined
            ? { menuItems: { create: menuCreate(input.menuItems) } }
            : {}),
        },
        select: { ...canonicalPlaceSelect, moderationStatus: true, archivedAt: true },
      });
      const images = await tx.placeImage.findMany({
        where: { placeId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return {
        ...canonicalPlaceSummary(place, images),
        moderationStatus: place.moderationStatus,
        archivedAt: place.archivedAt?.toISOString() ?? null,
      };
    });
  }

  async archive(placeId: string): Promise<void> {
    await this.db.place.update({ where: { id: placeId }, data: { archivedAt: new Date() } });
  }

  async hasVerifiedOwnership(placeId: string, userId: string): Promise<boolean> {
    return Boolean(
      await this.db.placeOwnership.findFirst({
        where: { placeId, userId, revokedAt: null },
        select: { id: true },
      }),
    );
  }

  async canManageOwnerMedia(placeId: string, userId: string): Promise<boolean> {
    if (await this.hasVerifiedOwnership(placeId, userId)) return true;
    return Boolean(
      await this.db.place.findFirst({
        where: {
          id: placeId,
          suggestedByUserId: userId,
          submissionOrigin: "OWNER",
          moderationStatus: "PENDING",
          archivedAt: null,
        },
        select: { id: true },
      }),
    );
  }

  async getImage(placeId: string, imageId: string): Promise<PublicPlaceImage | null> {
    return this.db.placeImage.findFirst({
      where: { id: imageId, placeId },
      select: { id: true, imageUrl: true, sortOrder: true },
    });
  }

  private async lockGallery(tx: Prisma.TransactionClient, placeId: string): Promise<void> {
    // Serialize existing-gallery reads and writes across API processes until commit.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Place" WHERE "id" = ${placeId} FOR NO KEY UPDATE`,
    );
  }

  async prepareImageUpload(placeId: string, imageId: string): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id: imageId,
        topic: PLACE_IMAGE_RECONCILE_TOPIC,
        aggregateType: "PlaceImage",
        aggregateId: placeId,
        payload: { placeId, imageId, objectKey: placeImageObjectKey(placeId, imageId) },
        // Existing reconciliation grace period exceeds the storage transport's 30s timeout.
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  async addPreparedImage(
    placeId: string,
    imageId: string,
    maxImages: number,
  ): Promise<PublicPlaceImage> {
    return this.createImage(
      placeId,
      imageId,
      placeManagedImagePath(placeId, imageId),
      maxImages,
      true,
    );
  }

  async addImage(
    placeId: string,
    imageId: string,
    imageUrl: string,
    maxImages: number,
  ): Promise<PublicPlaceImage> {
    return this.createImage(placeId, imageId, imageUrl, maxImages, false);
  }

  private async createImage(
    placeId: string,
    imageId: string,
    imageUrl: string,
    maxImages: number,
    prepared: boolean,
  ): Promise<PublicPlaceImage> {
    return this.db.$transaction(async (tx) => {
      await this.lockGallery(tx, placeId);
      if (prepared) {
        const intent = await tx.outboxEvent.deleteMany({
          where: {
            id: imageId,
            topic: PLACE_IMAGE_RECONCILE_TOPIC,
            aggregateId: placeId,
            status: "PENDING",
            attempts: 0,
            availableAt: { gt: new Date() },
          },
        });
        if (intent.count !== 1) throw new Error("PLACE_IMAGE_UPLOAD_EXPIRED");
      }
      const count = await tx.placeImage.count({ where: { placeId } });
      if (count >= maxImages) throw new Error("PLACE_IMAGE_LIMIT_REACHED");
      return tx.placeImage.create({
        data: { id: imageId, placeId, imageUrl, sortOrder: count },
        select: { id: true, imageUrl: true, sortOrder: true },
      });
    });
  }

  async deleteImage(placeId: string, imageId: string): Promise<PublicPlaceImage | null> {
    return this.db.$transaction(async (tx) => {
      await this.lockGallery(tx, placeId);
      const existing = await tx.placeImage.findFirst({
        where: { id: imageId, placeId },
        select: { id: true, imageUrl: true, sortOrder: true },
      });
      if (!existing) return null;
      await tx.placeImage.delete({ where: { id: imageId } });
      if (existing.imageUrl === placeManagedImagePath(placeId, imageId)) {
        await tx.outboxEvent.create({
          data: {
            id: imageId,
            topic: PLACE_IMAGE_RECONCILE_TOPIC,
            aggregateType: "PlaceImage",
            aggregateId: placeId,
            payload: { placeId, imageId, objectKey: placeImageObjectKey(placeId, imageId) },
          },
        });
      }
      const remaining = await tx.placeImage.findMany({
        where: { placeId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      for (const [index, image] of remaining.entries()) {
        await tx.placeImage.update({
          where: { id: image.id },
          data: { sortOrder: 1000 + index },
        });
      }
      for (const [index, image] of remaining.entries()) {
        await tx.placeImage.update({ where: { id: image.id }, data: { sortOrder: index } });
      }
      return existing;
    });
  }

  async reorderImages(
    placeId: string,
    imageIds: readonly string[],
  ): Promise<readonly PublicPlaceImage[]> {
    return this.db.$transaction(async (tx) => {
      await this.lockGallery(tx, placeId);
      const existing = await tx.placeImage.findMany({
        where: { placeId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      const expected = new Set(existing.map((image) => image.id));
      if (
        imageIds.length !== existing.length ||
        new Set(imageIds).size !== imageIds.length ||
        imageIds.some((id) => !expected.has(id))
      ) {
        throw new Error("PLACE_IMAGE_ORDER_INVALID");
      }
      for (const [index, id] of imageIds.entries()) {
        await tx.placeImage.update({ where: { id }, data: { sortOrder: 1000 + index } });
      }
      for (const [index, id] of imageIds.entries()) {
        await tx.placeImage.update({ where: { id }, data: { sortOrder: index } });
      }
      return tx.placeImage.findMany({
        where: { placeId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, imageUrl: true, sortOrder: true },
      });
    });
  }

  async claimOwnership(userId: string, placeId: string, input: PlaceOwnershipClaimInput) {
    return this.db.placeOwnershipClaim.upsert({
      where: { placeId_claimantUserId: { placeId, claimantUserId: userId } },
      create: { placeId, claimantUserId: userId, evidence: input.evidence },
      update: {
        evidence: input.evidence,
        status: "PENDING",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      select: { id: true, status: true },
    });
  }

  async pendingPlaces(): Promise<readonly PlaceReviewQueueItem[]> {
    const rows = await this.db.place.findMany({
      where: {
        moderationStatus: "PENDING",
        archivedAt: null,
        gearUpShop: { is: null },
      },
      select: {
        ...canonicalPlaceSelect,
        moderationStatus: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        suggestedBy: {
          select: {
            id: true,
            presentation: { select: { username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const images = rows.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: rows.map((row) => row.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupCanonicalPlaceImages(images);
    return rows
      .filter((row) => row.suggestedBy.presentation)
      .map((row) => ({
        id: row.id,
        status: row.moderationStatus,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.suggestedBy.id,
          username: row.suggestedBy.presentation!.username,
          displayName: row.suggestedBy.presentation!.displayName,
        },
        place: canonicalPlaceSummary(row, byPlace.get(row.id) ?? []),
      }));
  }

  async pendingOwnershipClaims(): Promise<readonly PlaceOwnershipReviewQueueItem[]> {
    const rows = await this.db.placeOwnershipClaim.findMany({
      where: {
        status: "PENDING",
        place: { moderationStatus: "APPROVED", archivedAt: null },
      },
      select: {
        id: true,
        status: true,
        evidence: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        place: { select: canonicalPlaceSelect },
        claimant: {
          select: {
            id: true,
            presentation: { select: { username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const images = rows.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: rows.map((row) => row.place.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupCanonicalPlaceImages(images);
    return rows
      .filter((row) => row.claimant.presentation)
      .map((row) => ({
        id: row.id,
        status: row.status,
        evidence: row.evidence,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.claimant.id,
          username: row.claimant.presentation!.username,
          displayName: row.claimant.presentation!.displayName,
        },
        place: canonicalPlaceSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));
  }

  async reviewPlace(actorUserId: string, placeId: string, input: PlaceModerationDecision) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const reviewedAt = new Date();
      const result = await tx.place.updateMany({
        where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
        data: {
          moderationStatus: status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!result.count) return false;

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `PLACE_${status}`,
          entityType: "Place",
          entityId: placeId,
          metadata: { note: input.note ?? null },
        },
      });
      return true;
    });
  }

  async reviewOwnershipClaim(actorUserId: string, claimId: string, input: PlaceModerationDecision) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const claim = await tx.placeOwnershipClaim.findFirst({
        where: {
          id: claimId,
          status: "PENDING",
          place: { moderationStatus: "APPROVED", archivedAt: null },
        },
        select: { placeId: true, claimantUserId: true },
      });
      if (!claim) return false;
      const reviewedAt = new Date();
      const result = await tx.placeOwnershipClaim.updateMany({
        where: { id: claimId, status: "PENDING" },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!result.count) return false;
      if (status === "APPROVED") {
        await tx.placeOwnership.upsert({
          where: {
            placeId_userId: { placeId: claim.placeId, userId: claim.claimantUserId },
          },
          create: {
            placeId: claim.placeId,
            userId: claim.claimantUserId,
            verifiedByUserId: actorUserId,
            verifiedAt: reviewedAt,
          },
          update: {
            verifiedByUserId: actorUserId,
            verifiedAt: reviewedAt,
            revokedAt: null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `PLACE_OWNERSHIP_${status}`,
          entityType: "PlaceOwnershipClaim",
          entityId: claimId,
          metadata: { placeId: claim.placeId, note: input.note ?? null },
        },
      });
      return true;
    });
  }
}
