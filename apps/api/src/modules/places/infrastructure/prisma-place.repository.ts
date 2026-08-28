import { randomUUID } from "node:crypto";
import type {
  AdminQueueItem,
  ManagedPlaceSummary,
  ModerationDecisionInput,
  PitchRentalCurrency,
  PlaceDuplicateMatch,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceImage,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { Prisma, type PrismaClient } from "@hooma/database";
import type { PlaceRepository } from "../application/place.repository.js";

const OWNER_SUBMISSION_CLAIM_EVIDENCE = "Ownership asserted during Place submission";

type PlaceIdentityInput = Pick<
  PlaceSuggestionInput,
  "name" | "address" | "phone" | "websiteUrl" | "latitude" | "longitude"
>;

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

function normalizeIdentityText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function canonicalPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/[^0-9]/g, "") ?? "";
  return digits || null;
}

function canonicalWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?/i, "")
    .replace(/\/+$/, "")
    .toLocaleLowerCase();
  return normalized || null;
}

function duplicateLockKeys(input: PlaceIdentityInput): string[] {
  const keys = [
    `place:name-address:${normalizeIdentityText(input.name)}|${normalizeIdentityText(input.address)}`,
  ];
  const phone = canonicalPhone(input.phone);
  const website = canonicalWebsite(input.websiteUrl);
  if (phone) keys.push(`place:phone:${phone}`);
  if (website) keys.push(`place:website:${website}`);
  if (input.latitude != null && input.longitude != null) {
    keys.push(
      `place:name-coordinates:${normalizeIdentityText(input.name)}|${input.latitude.toFixed(7)}|${input.longitude.toFixed(7)}`,
    );
  }
  return [...new Set(keys)].sort();
}

async function lockPlaceIdentity(tx: Prisma.TransactionClient, input: PlaceIdentityInput) {
  for (const key of duplicateLockKeys(input)) {
    await tx.$queryRaw<Array<{ locked: string }>>(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`,
    );
  }
}

async function findDuplicateCandidate(
  tx: Prisma.TransactionClient,
  input: PlaceIdentityInput,
  excludePlaceId?: string,
): Promise<{ id: string; matchedBy: PlaceDuplicateMatch } | null> {
  const normalizedName = normalizeIdentityText(input.name);
  const normalizedAddress = normalizeIdentityText(input.address);
  const phone = canonicalPhone(input.phone);
  const website = canonicalWebsite(input.websiteUrl);
  const exclude = excludePlaceId ? Prisma.sql`AND "id" <> ${excludePlaceId}` : Prisma.sql``;

  const nameAddress = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "Place"
      WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
        ${exclude}
        AND lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')) = ${normalizedName}
        AND lower(regexp_replace(btrim("address"), '[[:space:]]+', ' ', 'g')) = ${normalizedAddress}
      ORDER BY "createdAt" ASC, "id" ASC
      LIMIT 1
    `,
  );
  if (nameAddress[0]) return { id: nameAddress[0].id, matchedBy: "NAME_ADDRESS" };

  if (phone) {
    const phoneMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "phone" IS NOT NULL
          AND regexp_replace("phone", '[^0-9]', '', 'g') = ${phone}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (phoneMatch[0]) return { id: phoneMatch[0].id, matchedBy: "PHONE" };
  }

  if (website) {
    const websiteMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "websiteUrl" IS NOT NULL
          AND lower(
            regexp_replace(
              regexp_replace(btrim("websiteUrl"), '^https?://(www[.])?', '', 'i'),
              '/+$',
              ''
            )
          ) = ${website}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (websiteMatch[0]) return { id: websiteMatch[0].id, matchedBy: "WEBSITE" };
  }

  if (input.latitude != null && input.longitude != null) {
    const latitude = new Prisma.Decimal(input.latitude);
    const longitude = new Prisma.Decimal(input.longitude);
    const coordinateMatch = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Place"
        WHERE "moderationStatus" IN ('PENDING', 'APPROVED')
          ${exclude}
          AND "latitude" = ${latitude}
          AND "longitude" = ${longitude}
          AND lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g')) = ${normalizedName}
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1
      `,
    );
    if (coordinateMatch[0]) {
      return { id: coordinateMatch[0].id, matchedBy: "NAME_COORDINATES" };
    }
  }

  return null;
}

function pitchRentalCurrency(value: string | null): PitchRentalCurrency | null {
  return value === "TND" || value === "EUR" || value === "USD" ? value : null;
}

function suggestedCapabilityCreate(input: PlaceSuggestionInput) {
  if (!input.suggestedCapabilities?.includes("PITCH")) return [];
  if (!input.pitch) throw new Error("PITCH_PRICING_REQUIRED");
  return [
    {
      kind: "PITCH" as const,
      hourlyRateMinor: input.pitch.hourlyRateMinor,
      currency: input.pitch.currency,
    },
  ];
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
  description: true,
  category: true,
  email: true,
  submissionOrigin: true,
  menuItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, price: true, currency: true },
  },
});

type PlaceRow = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;
type PlaceImageRow = { id: string; placeId: string; imageUrl: string; sortOrder: number };

function placeSummary(place: PlaceRow, images: readonly PlaceImageRow[] = []): PublicPlaceSummary {
  const publicImages: PublicPlaceImage[] = images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
  }));
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
    imageUrl: publicImages[0]?.imageUrl ?? null,
    images: publicImages,
    description: place.description,
    category: place.category,
    email: place.email,
    menuItems: place.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price.toNumber(),
      currency: item.currency,
    })),
    submissionOrigin: place.submissionOrigin,
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

function canonicalImageUrls(input: Pick<PlaceSuggestionInput, "imageUrl" | "imageUrls">): string[] {
  if (input.imageUrls.length) return input.imageUrls;
  return input.imageUrl ? [input.imageUrl] : [];
}

function imageCreate(imageUrls: readonly string[]) {
  return imageUrls.slice(0, 4).map((imageUrl, sortOrder) => ({ imageUrl, sortOrder }));
}

function groupImages(rows: readonly PlaceImageRow[]): Map<string, PlaceImageRow[]> {
  const grouped = new Map<string, PlaceImageRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.placeId) ?? [];
    group.push(row);
    grouped.set(row.placeId, group);
  }
  return grouped;
}

export class PrismaPlaceRepository implements PlaceRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(): Promise<readonly PublicPlaceSummary[]> {
    const places = await this.db.place.findMany({
      where: { moderationStatus: "APPROVED", archivedAt: null },
      select: placeSelect,
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
    const images = places.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: places.map((place) => place.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupImages(images);
    return places.map((place) => placeSummary(place, byPlace.get(place.id) ?? []));
  }

  async suggest(userId: string, input: PlaceSuggestionInput): Promise<PlaceSuggestionResult> {
    return this.db.$transaction(async (tx) => {
      await lockPlaceIdentity(tx, input);
      const duplicate = await findDuplicateCandidate(tx, input);
      if (duplicate) {
        const existing = await tx.place.findUniqueOrThrow({
          where: { id: duplicate.id },
          select: { ...placeSelect, moderationStatus: true, archivedAt: true },
        });
        const images = await tx.placeImage.findMany({
          where: { placeId: existing.id },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        return {
          outcome: "EXISTING",
          place: placeSummary(existing, images),
          status: existing.moderationStatus,
          matchedBy: duplicate.matchedBy,
          archivedAt: existing.archivedAt?.toISOString() ?? null,
        };
      }

      const imageUrls = canonicalImageUrls(input);
      const capabilityCreates = suggestedCapabilityCreate(input);
      const isPitchSuggestion = capabilityCreates.some((capability) => capability.kind === "PITCH");
      const submissionOrigin = isPitchSuggestion ? "FANHUB" : input.submissionOrigin;
      const ownerOrigin = submissionOrigin === "OWNER";
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
          description: input.description ?? null,
          category: input.category ?? null,
          email: input.email ?? null,
          submissionOrigin,
          suggestedByUserId: userId,
          menuItems: { create: menuCreate(input.menuItems) },
          ...(ownerOrigin
            ? {
                ownershipClaims: {
                  create: {
                    claimantUserId: userId,
                    evidence: OWNER_SUBMISSION_CLAIM_EVIDENCE,
                  },
                },
              }
            : {}),
          ...(capabilityCreates.length
            ? {
                capabilities: {
                  create: capabilityCreates,
                },
              }
            : {}),
        },
        select: { ...placeSelect, moderationStatus: true },
      });
      if (imageUrls.length) {
        await tx.placeImage.createMany({
          data: imageCreate(imageUrls).map((image) => ({ ...image, placeId: place.id })),
        });
      }
      const images = await tx.placeImage.findMany({
        where: { placeId: place.id },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return {
        outcome: "CREATED",
        place: placeSummary(place, images),
        status: place.moderationStatus,
        matchedBy: null,
        archivedAt: null,
      };
    });
  }

  async getApproved(placeId: string): Promise<PublicPlaceSummary | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED", archivedAt: null },
      select: placeSelect,
    });
    if (!place) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return placeSummary(place, images);
  }

  async getManaged(placeId: string): Promise<ManagedPlaceSummary | null> {
    const place = await this.db.place.findUnique({
      where: { id: placeId },
      select: { ...placeSelect, moderationStatus: true, archivedAt: true },
    });
    if (!place) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return {
      ...placeSummary(place, images),
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
        await lockPlaceIdentity(tx, identity);
        if (await findDuplicateCandidate(tx, identity, placeId)) {
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
            data: imageCreate(imageUrls).map((image) => ({ ...image, placeId })),
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
        select: { ...placeSelect, moderationStatus: true, archivedAt: true },
      });
      const images = await tx.placeImage.findMany({
        where: { placeId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return {
        ...placeSummary(place, images),
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

  async pendingPlaces(): Promise<readonly AdminQueueItem[]> {
    const rows = await this.db.place.findMany({
      where: { moderationStatus: "PENDING", archivedAt: null },
      select: {
        ...placeSelect,
        moderationStatus: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        capabilities: {
          where: { kind: "PITCH", status: "PENDING" },
          select: { kind: true, hourlyRateMinor: true, currency: true },
          take: 1,
        },
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
    const byPlace = groupImages(images);
    return rows
      .filter((row) => row.suggestedBy.presentation)
      .map((row) => {
        const pitch = row.capabilities[0];
        return {
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
          place: placeSummary(row, byPlace.get(row.id) ?? []),
          ...(pitch
            ? {
                kind: pitch.kind,
                hourlyRateMinor: pitch.hourlyRateMinor,
                currency: pitchRentalCurrency(pitch.currency),
              }
            : {}),
        };
      });
  }

  async pendingOwnershipClaims(): Promise<readonly AdminQueueItem[]> {
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
    const images = rows.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: rows.map((row) => row.place.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupImages(images);
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
        place: placeSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));
  }

  async reviewPlace(actorUserId: string, placeId: string, input: ModerationDecisionInput) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const place = await tx.place.findFirst({
        where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
        select: {
          capabilities: {
            where: { status: "PENDING" },
            select: { id: true, kind: true, hourlyRateMinor: true, currency: true },
          },
        },
      });
      if (!place) return false;

      const pitch = place.capabilities.find((capability) => capability.kind === "PITCH");
      if (
        status === "APPROVED" &&
        pitch &&
        (pitch.hourlyRateMinor === null || pitchRentalCurrency(pitch.currency) === null)
      ) {
        throw new Error("PITCH_PRICING_REQUIRED");
      }

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

      await tx.placeCapability.updateMany({
        where: { placeId, status: "PENDING" },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });

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
