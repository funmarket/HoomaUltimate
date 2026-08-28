import type {
  ManagedPlaceSummary,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceSummary,
} from "@hooma/contracts/places";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  PendingPlaceOwnershipReview,
  PendingPlaceReview,
  PlaceModerationDecision,
  PlaceRepository,
} from "../application/place.repository.js";
import {
  canonicalPlaceImageCreate,
  canonicalPlaceSelect,
  canonicalPlaceSummary,
  findCanonicalPlaceDuplicate,
  groupCanonicalPlaceImages,
  lockCanonicalPlaceIdentity,
  suggestCanonicalPlace,
} from "./canonical-place.persistence.js";

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
      where: { moderationStatus: "APPROVED", archivedAt: null },
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
      suggestCanonicalPlace(tx, userId, input, input.submissionOrigin),
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
    return place.suggestedByUserId === userId && place.moderationStatus === "PENDING";
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
      const imageUrls =
        input.imageUrls !== undefined
          ? input.imageUrls
          : input.imageUrl !== undefined
            ? input.imageUrl
              ? [input.imageUrl]
              : []
            : undefined;
      if (imageUrls !== undefined) {
        await tx.placeImage.deleteMany({ where: { placeId } });
        if (imageUrls.length) {
          await tx.placeImage.createMany({
            data: canonicalPlaceImageCreate(imageUrls).map((image) => ({ ...image, placeId })),
          });
        }
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

  async pendingPlaces(): Promise<readonly PendingPlaceReview[]> {
    const rows = await this.db.place.findMany({
      where: { moderationStatus: "PENDING", archivedAt: null },
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

  async pendingOwnershipClaims(): Promise<readonly PendingPlaceOwnershipReview[]> {
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

  async reviewOwnershipClaim(
    actorUserId: string,
    claimId: string,
    input: PlaceModerationDecision,
  ) {
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
          where: { placeId_userId: { placeId: claim.placeId, userId: claim.claimantUserId } },
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
