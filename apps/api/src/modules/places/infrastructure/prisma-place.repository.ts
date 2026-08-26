import { randomUUID } from "node:crypto";
import type {
  AdminQueueItem,
  ManagedPlaceSummary,
  ModerationDecisionInput,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceUpdateInput,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { Prisma, type PrismaClient } from "@hooma/database";
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

function duplicateKey(input: Pick<PlaceSuggestionInput, "name" | "address">): string {
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return `${normalize(input.name)}|${normalize(input.address)}`;
}

const placeSelect = Prisma.validator<Prisma.PlaceSelect>()({
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
  imageUrl: true,
  description: true,
  category: true,
  email: true,
  menuItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, price: true, currency: true },
  },
});

type PlaceRow = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;

function placeSummary(place: PlaceRow): PublicPlaceSummary {
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
    imageUrl: place.imageUrl,
    description: place.description,
    category: place.category,
    email: place.email,
    menuItems: place.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price.toNumber(),
      currency: item.currency,
    })),
  };
}

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
      select: placeSelect,
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
    return places.map(placeSummary);
  }

  async suggest(userId: string, input: PlaceSuggestionInput) {
    return this.db.$transaction(async (tx) => {
      const key = duplicateKey(input);
      await tx.$queryRaw<Array<{ locked: string }>>(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`,
      );

      const existing = await tx.place.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
          address: { equals: input.address, mode: "insensitive" },
          moderationStatus: { in: ["PENDING", "APPROVED"] },
        },
        select: { id: true },
      });
      if (existing) throw new Error("PLACE_ALREADY_EXISTS");

      const place = await tx.place.create({
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
          imageUrl: input.imageUrl ?? null,
          description: input.description ?? null,
          category: input.category ?? null,
          email: input.email ?? null,
          suggestedByUserId: userId,
          menuItems: { create: menuCreate(input.menuItems) },
        },
        select: { ...placeSelect, moderationStatus: true },
      });
      return { ...placeSummary(place), status: place.moderationStatus };
    });
  }

  async getApproved(placeId: string): Promise<PublicPlaceSummary | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED", archivedAt: null },
      select: placeSelect,
    });
    return place ? placeSummary(place) : null;
  }

  async getManaged(placeId: string): Promise<ManagedPlaceSummary | null> {
    const place = await this.db.place.findUnique({
      where: { id: placeId },
      select: { ...placeSelect, moderationStatus: true, archivedAt: true },
    });
    return place
      ? {
          ...placeSummary(place),
          moderationStatus: place.moderationStatus,
          archivedAt: place.archivedAt?.toISOString() ?? null,
        }
      : null;
  }

  async canManage(placeId: string, userId: string): Promise<boolean> {
    return Boolean(
      await this.db.place.findFirst({
        where: {
          id: placeId,
          OR: [
            { suggestedByUserId: userId },
            { ownerships: { some: { userId, revokedAt: null } } },
          ],
        },
        select: { id: true },
      }),
    );
  }

  async update(placeId: string, input: PlaceUpdateInput): Promise<ManagedPlaceSummary> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.place.findUniqueOrThrow({
        where: { id: placeId },
        select: { name: true, address: true },
      });
      const name = input.name ?? current.name;
      const address = input.address ?? current.address;
      if (name !== current.name || address !== current.address) {
        const key = duplicateKey({ name, address });
        await tx.$queryRaw<Array<{ locked: string }>>(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`,
        );
        const duplicate = await tx.place.findFirst({
          where: {
            id: { not: placeId },
            name: { equals: name, mode: "insensitive" },
            address: { equals: address, mode: "insensitive" },
            moderationStatus: { in: ["PENDING", "APPROVED"] },
          },
          select: { id: true },
        });
        if (duplicate) throw new Error("PLACE_ALREADY_EXISTS");
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
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.menuItems !== undefined
            ? { menuItems: { create: menuCreate(input.menuItems) } }
            : {}),
        },
        select: { ...placeSelect, moderationStatus: true, archivedAt: true },
      });
      return {
        ...placeSummary(place),
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
      where: { moderationStatus: "PENDING", archivedAt: null },
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
      where: { status: "PENDING", place: { archivedAt: null } },
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
      const place = await tx.place.findFirst({
        where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
        select: { suggestedByUserId: true },
      });
      if (!place) return false;

      const result = await tx.place.updateMany({
        where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
        data: {
          moderationStatus: status,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
        },
      });
      if (!result.count) return false;

      if (status === "APPROVED") {
        await tx.placeOwnership.upsert({
          where: { placeId_userId: { placeId, userId: place.suggestedByUserId } },
          create: {
            placeId,
            userId: place.suggestedByUserId,
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
          action: `PLACE_${status}`,
          entityType: "Place",
          entityId: placeId,
          metadata: { note: input.note ?? null },
        },
      });
      return true;
    });
  }

  async reviewOwnershipClaim(actorUserId: string, claimId: string, input: ModerationDecisionInput) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const claim = await tx.placeOwnershipClaim.findFirst({
        where: { id: claimId, status: "PENDING", place: { archivedAt: null } },
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
