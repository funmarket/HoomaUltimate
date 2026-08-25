import { randomUUID } from "node:crypto";
import type {
  AdminQueueItem,
  ModerationDecisionInput,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import type { PrismaClient } from "@hooma/database";
import type { PlaceRepository } from "../application/place.repository.js";

function slugBase(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "place"
  );
}

function placeSummary(place: {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string | null;
  houma: string | null;
  latitude: { toNumber(): number } | null;
  longitude: { toNumber(): number } | null;
  phone: string | null;
  websiteUrl: string | null;
}): PublicPlaceSummary {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    address: place.address,
    city: place.city,
    houma: place.houma,
    latitude: place.latitude?.toNumber() ?? null,
    longitude: place.longitude?.toNumber() ?? null,
    phone: place.phone,
    websiteUrl: place.websiteUrl,
  };
}

const placeSelect = {
  id: true,
  slug: true,
  name: true,
  address: true,
  city: true,
  houma: true,
  latitude: true,
  longitude: true,
  phone: true,
  websiteUrl: true,
} as const;

export class PrismaPlaceRepository implements PlaceRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(): Promise<readonly PublicPlaceSummary[]> {
    const places = await this.db.place.findMany({
      where: { moderationStatus: "APPROVED" },
      select: placeSelect,
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
    return places.map(placeSummary);
  }

  async suggest(userId: string, input: PlaceSuggestionInput) {
    const place = await this.db.place.create({
      data: {
        slug: `${slugBase(input.name)}-${randomUUID().slice(0, 8)}`,
        name: input.name,
        address: input.address,
        city: input.city ?? null,
        houma: input.houma ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        phone: input.phone ?? null,
        websiteUrl: input.websiteUrl ?? null,
        suggestedByUserId: userId,
      },
      select: { ...placeSelect, moderationStatus: true },
    });
    return { ...placeSummary(place), status: place.moderationStatus };
  }

  async getApproved(placeId: string): Promise<PublicPlaceSummary | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED" },
      select: placeSelect,
    });
    return place ? placeSummary(place) : null;
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
    const claim = await this.db.placeOwnershipClaim.upsert({
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
    return claim;
  }

  async pendingPlaces(): Promise<readonly AdminQueueItem[]> {
    const rows = await this.db.place.findMany({
      where: { moderationStatus: "PENDING" },
      select: {
        ...placeSelect,
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
        place: placeSummary(row),
      }));
  }

  async pendingOwnershipClaims(): Promise<readonly AdminQueueItem[]> {
    const rows = await this.db.placeOwnershipClaim.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        status: true,
        evidence: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        place: { select: placeSelect },
        claimant: {
          select: {
            id: true,
            presentation: { select: { username: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows
      .filter((row) => row.claimant.presentation)
      .map((row) => ({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        evidence: row.evidence,
        applicant: {
          userId: row.claimant.id,
          username: row.claimant.presentation!.username,
          displayName: row.claimant.presentation!.displayName,
        },
        place: placeSummary(row.place),
      }));
  }

  async reviewPlace(actorUserId: string, placeId: string, input: ModerationDecisionInput) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const result = await tx.place.updateMany({
        where: { id: placeId, moderationStatus: "PENDING" },
        data: {
          moderationStatus: status,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
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
    input: ModerationDecisionInput,
  ) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const claim = await tx.placeOwnershipClaim.findFirst({
        where: { id: claimId, status: "PENDING" },
        select: { placeId: true, claimantUserId: true },
      });
      if (!claim) return false;
      const result = await tx.placeOwnershipClaim.updateMany({
        where: { id: claimId, status: "PENDING" },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
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
          },
          update: {
            verifiedByUserId: actorUserId,
            verifiedAt: new Date(),
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
