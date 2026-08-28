import type { PublicPlaceImage, PublicPlaceSummary } from "@hooma/contracts/places";
import type {
  PitchApplicationInput,
  PitchRentalCurrency,
  PublicPitch,
} from "@hooma/contracts/pitch";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  PendingPitchReview,
  PitchModerationDecision,
  PitchRepository,
} from "../application/pitch.repository.js";

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

const pitchSelect = Prisma.validator<Prisma.PlaceCapabilitySelect>()({
  id: true,
  summary: true,
  hourlyRateMinor: true,
  currency: true,
  place: { select: placeSelect },
});

type PlaceRow = Prisma.PlaceGetPayload<{ select: typeof placeSelect }>;
type PitchRow = Prisma.PlaceCapabilityGetPayload<{ select: typeof pitchSelect }>;
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

function pitchSummary(row: PitchRow, images: readonly PlaceImageRow[] = []): PublicPitch | null {
  const currency = pitchRentalCurrency(row.currency);
  if (row.hourlyRateMinor === null || currency === null) return null;
  return {
    id: row.id,
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

export class PrismaPitchRepository implements PitchRepository {
  constructor(private readonly db: PrismaClient) {}

  async listApproved(): Promise<readonly PublicPitch[]> {
    const rows = await this.db.placeCapability.findMany({
      where: {
        kind: "PITCH",
        status: "APPROVED",
        place: { moderationStatus: "APPROVED", archivedAt: null },
      },
      select: pitchSelect,
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
      const summary = pitchSummary(row, byPlace.get(row.place.id) ?? []);
      return summary ? [summary] : [];
    });
  }

  async getApprovedByPlace(placeId: string): Promise<PublicPitch | null> {
    const row = await this.db.placeCapability.findFirst({
      where: {
        kind: "PITCH",
        placeId,
        status: "APPROVED",
        place: { moderationStatus: "APPROVED", archivedAt: null },
      },
      select: pitchSelect,
    });
    if (!row) return null;
    const images = await this.db.placeImage.findMany({
      where: { placeId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return pitchSummary(row, images);
  }

  async getManagementState(placeId: string) {
    const [approved, pending, latestRejected] = await Promise.all([
      this.db.placeCapability.findFirst({
        where: {
          kind: "PITCH",
          placeId,
          status: "APPROVED",
          place: { moderationStatus: "APPROVED", archivedAt: null },
        },
        select: {
          id: true,
          summary: true,
          hourlyRateMinor: true,
          currency: true,
          reviewedAt: true,
        },
      }),
      this.db.placeCapabilityApplication.findFirst({
        where: { kind: "PITCH", placeId, status: "PENDING" },
        select: {
          id: true,
          summary: true,
          hourlyRateMinor: true,
          currency: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.db.placeCapabilityApplication.findFirst({
        where: { kind: "PITCH", placeId, status: "REJECTED" },
        select: {
          id: true,
          summary: true,
          hourlyRateMinor: true,
          currency: true,
          createdAt: true,
          reviewedAt: true,
          reviewNote: true,
        },
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      }),
    ]);

    const approvedCurrency = pitchRentalCurrency(approved?.currency ?? null);
    return {
      approvedPitch:
        approved && approved.hourlyRateMinor !== null && approvedCurrency
          ? {
              id: approved.id,
              summary: approved.summary,
              hourlyRateMinor: approved.hourlyRateMinor,
              currency: approvedCurrency,
              approvedAt: approved.reviewedAt?.toISOString() ?? null,
            }
          : null,
      pendingApplication: pending
        ? {
            id: pending.id,
            summary: pending.summary,
            hourlyRateMinor: pending.hourlyRateMinor,
            currency: pitchRentalCurrency(pending.currency),
            submittedAt: pending.createdAt.toISOString(),
          }
        : null,
      latestRejectedApplication: latestRejected
        ? {
            id: latestRejected.id,
            summary: latestRejected.summary,
            hourlyRateMinor: latestRejected.hourlyRateMinor,
            currency: pitchRentalCurrency(latestRejected.currency),
            submittedAt: latestRejected.createdAt.toISOString(),
            reviewedAt: latestRejected.reviewedAt?.toISOString() ?? null,
            reviewNote: latestRejected.reviewNote,
          }
        : null,
    };
  }

  async submitRevision(userId: string, placeId: string, input: PitchApplicationInput) {
    try {
      return await this.db.placeCapabilityApplication.create({
        data: {
          placeId,
          applicantUserId: userId,
          kind: "PITCH",
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

  async pendingInitialPlaceIds(): Promise<readonly string[]> {
    const rows = await this.db.placeCapability.findMany({
      where: {
        kind: "PITCH",
        status: "PENDING",
        place: { moderationStatus: "PENDING", archivedAt: null },
      },
      select: { placeId: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => row.placeId);
  }

  async pending(): Promise<readonly PendingPitchReview[]> {
    const [initialRows, revisionRows] = await Promise.all([
      this.db.placeCapability.findMany({
        where: {
          kind: "PITCH",
          status: "PENDING",
          place: { moderationStatus: "PENDING", archivedAt: null },
        },
        select: {
          id: true,
          status: true,
          summary: true,
          hourlyRateMinor: true,
          currency: true,
          createdAt: true,
          reviewedAt: true,
          reviewNote: true,
          place: {
            select: {
              ...placeSelect,
              moderationStatus: true,
              suggestedBy: {
                select: {
                  id: true,
                  presentation: { select: { username: true, displayName: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.db.placeCapabilityApplication.findMany({
        where: { kind: "PITCH", status: "PENDING" },
        select: {
          id: true,
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
      }),
    ]);

    const placeIds = [
      ...initialRows.map((row) => row.place.id),
      ...revisionRows.map((row) => row.place.id),
    ];
    const images = placeIds.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: [...new Set(placeIds)] } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [];
    const byPlace = groupImages(images);

    const initial: PendingPitchReview[] = initialRows
      .filter((row) => row.place.suggestedBy.presentation)
      .map((row) => ({
        id: row.id,
        target: "INITIAL_SUGGESTION",
        status: row.status,
        placeStatus: row.place.moderationStatus,
        summary: row.summary,
        hourlyRateMinor: row.hourlyRateMinor,
        currency: pitchRentalCurrency(row.currency),
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.place.suggestedBy.id,
          username: row.place.suggestedBy.presentation!.username,
          displayName: row.place.suggestedBy.presentation!.displayName,
        },
        place: placeSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));

    const revisions: PendingPitchReview[] = revisionRows
      .filter((row) => row.applicant.presentation)
      .map((row) => ({
        id: row.id,
        target: "OWNER_REVISION",
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

    return [...initial, ...revisions].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  async reviewOwnerRevision(
    actorUserId: string,
    applicationId: string,
    input: PitchModerationDecision,
  ) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const application = await tx.placeCapabilityApplication.findFirst({
        where: { id: applicationId, kind: "PITCH", status: "PENDING" },
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
        where: { id: applicationId, kind: "PITCH", status: "PENDING" },
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
          where: { placeId_kind: { placeId: application.placeId, kind: "PITCH" } },
          create: {
            placeId: application.placeId,
            kind: "PITCH",
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
          action: `PITCH_APPLICATION_${status}`,
          entityType: "PlaceCapabilityApplication",
          entityId: applicationId,
          metadata: { placeId: application.placeId, kind: "PITCH", note: input.note ?? null },
        },
      });
      return true;
    });
  }
}
