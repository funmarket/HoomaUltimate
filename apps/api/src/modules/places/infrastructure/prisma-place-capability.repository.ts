import type {
  AdminQueueItem,
  ModerationDecisionInput,
  PitchRentalCurrency,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PublicPlaceCapability,
  PublicPlaceImage,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { Prisma, type PrismaClient } from "@hooma/database";
import type { PlaceCapabilityRepository } from "../application/place-capability.repository.js";

const OWNER_SUBMISSION_EVIDENCE = "Ownership asserted during Place submission";

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
  suggestedByUserId: true,
  ownershipClaims: {
    select: { claimantUserId: true, evidence: true },
  },
  menuItems: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, price: true, currency: true },
  },
});

const capabilitySelect = Prisma.validator<Prisma.PlaceCapabilitySelect>()({
  id: true,
  kind: true,
  summary: true,
  hourlyRateMinor: true,
  currency: true,
  place: { select: placeSelect },
});

type PlaceRow = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;
type CapabilityRow = Prisma.PlaceCapabilityGetPayload<{ select: typeof capabilitySelect }>;
type PlaceImageRow = { id: string; placeId: string; imageUrl: string; sortOrder: number };

function pitchRentalCurrency(value: string | null): PitchRentalCurrency | null {
  return value === "TND" || value === "EUR" || value === "USD" ? value : null;
}

function placeSummary(place: PlaceRow, images: readonly PlaceImageRow[] = []): PublicPlaceSummary {
  const publicImages: PublicPlaceImage[] = images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
  }));
  const ownerSubmitted = place.ownershipClaims.some(
    (claim) =>
      claim.claimantUserId === place.suggestedByUserId &&
      claim.evidence === OWNER_SUBMISSION_EVIDENCE,
  );
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
    submissionOrigin: ownerSubmitted ? "OWNER" : "FANHUB",
  };
}

function capabilitySummary(
  row: CapabilityRow,
  images: readonly PlaceImageRow[] = [],
): PublicPlaceCapability | null {
  const currency = pitchRentalCurrency(row.currency);
  if (row.hourlyRateMinor === null || currency === null) return null;
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    hourlyRateMinor: row.hourlyRateMinor,
    currency,
    place: placeSummary(row.place, images),
  };
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

export class PrismaPlaceCapabilityRepository implements PlaceCapabilityRepository {
  constructor(private readonly db: PrismaClient) {}

  async listApproved(kind: PlaceCapabilityKind): Promise<readonly PublicPlaceCapability[]> {
    const rows = await this.db.placeCapability.findMany({
      where: {
        kind,
        status: "APPROVED",
        place: { moderationStatus: "APPROVED", archivedAt: null },
      },
      select: capabilitySelect,
      orderBy: { updatedAt: "desc" },
    });
    const images = rows.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: rows.map((row) => row.place.id) } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupImages(images);
    return rows.flatMap((row) => {
      const summary = capabilitySummary(row, byPlace.get(row.place.id) ?? []);
      return summary ? [summary] : [];
    });
  }

  async getApprovedByPlace(
    kind: PlaceCapabilityKind,
    placeId: string,
  ): Promise<PublicPlaceCapability | null> {
    const row = await this.db.placeCapability.findFirst({
      where: {
        kind,
        placeId,
        status: "APPROVED",
        place: { moderationStatus: "APPROVED", archivedAt: null },
      },
      select: capabilitySelect,
    });
    if (!row) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return capabilitySummary(row, images);
  }

  async submit(
    userId: string,
    placeId: string,
    kind: PlaceCapabilityKind,
    input: PlaceCapabilityApplicationInput,
  ) {
    try {
      return await this.db.placeCapabilityApplication.create({
        data: {
          placeId,
          applicantUserId: userId,
          kind,
          summary: input.summary,
          hourlyRateMinor: input.hourlyRateMinor,
          currency: input.currency,
        },
        select: { id: true, status: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  async pending(kind: PlaceCapabilityKind): Promise<readonly AdminQueueItem[]> {
    const rows = await this.db.placeCapabilityApplication.findMany({
      where: { kind, status: "PENDING" },
      select: {
        id: true,
        kind: true,
        status: true,
        summary: true,
        hourlyRateMinor: true,
        currency: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
        place: { select: placeSelect },
        applicant: {
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
      .filter((row) => row.applicant.presentation)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        summary: row.summary,
        hourlyRateMinor: row.hourlyRateMinor,
        currency: pitchRentalCurrency(row.currency),
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.applicant.id,
          username: row.applicant.presentation!.username,
          displayName: row.applicant.presentation!.displayName,
        },
        place: placeSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));
  }

  async review(
    actorUserId: string,
    applicationId: string,
    kind: PlaceCapabilityKind,
    input: ModerationDecisionInput,
  ) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const application = await tx.placeCapabilityApplication.findFirst({
        where: { id: applicationId, kind, status: "PENDING" },
        select: {
          placeId: true,
          summary: true,
          hourlyRateMinor: true,
          currency: true,
        },
      });
      if (!application) return false;
      if (
        status === "APPROVED" &&
        (application.hourlyRateMinor === null || pitchRentalCurrency(application.currency) === null)
      ) {
        throw new Error("PITCH_PRICING_REQUIRED");
      }

      const reviewedAt = new Date();
      const result = await tx.placeCapabilityApplication.updateMany({
        where: { id: applicationId, kind, status: "PENDING" },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!result.count) return false;

      if (status === "APPROVED") {
        await tx.placeCapability.upsert({
          where: { placeId_kind: { placeId: application.placeId, kind } },
          create: {
            placeId: application.placeId,
            kind,
            status: "APPROVED",
            summary: application.summary,
            hourlyRateMinor: application.hourlyRateMinor,
            currency: application.currency,
            reviewedByUserId: actorUserId,
            reviewedAt,
            reviewNote: input.note ?? null,
          },
          update: {
            status: "APPROVED",
            summary: application.summary,
            hourlyRateMinor: application.hourlyRateMinor,
            currency: application.currency,
            reviewedByUserId: actorUserId,
            reviewedAt,
            reviewNote: input.note ?? null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `${kind}_APPLICATION_${status}`,
          entityType: "PlaceCapabilityApplication",
          entityId: applicationId,
          metadata: { placeId: application.placeId, kind, note: input.note ?? null },
        },
      });
      return true;
    });
  }
}
