import type { ModerationDecisionInput } from "@hooma/contracts/moderation";
import type {
  PitchApplicationInput,
  PitchPlaceSuggestionInput,
  PitchPlaceSuggestionResult,
  PitchRentalCurrency,
  PitchReviewQueueItem,
  PitchReviewTarget,
  PublicPitch,
} from "@hooma/contracts/pitch";
import { Prisma, type PrismaClient } from "@hooma/database";
import {
  canonicalPlaceSelect,
  canonicalPlaceSummary,
  groupCanonicalPlaceImages,
  suggestCanonicalPlace,
} from "../../places/infrastructure/canonical-place.persistence.js";
import type { PitchRepository } from "../application/pitch.repository.js";

const pitchSelect = Prisma.validator<Prisma.PlaceCapabilitySelect>()({
  id: true,
  summary: true,
  hourlyRateMinor: true,
  currency: true,
  place: { select: canonicalPlaceSelect },
});

type PitchRow = Prisma.PlaceCapabilityGetPayload<{ select: typeof pitchSelect }>;
type PlaceImageRow = { id: string; placeId: string; imageUrl: string; sortOrder: number };

function pitchRentalCurrency(value: string | null): PitchRentalCurrency | null {
  return value === "TND" || value === "EUR" || value === "USD" ? value : null;
}

function pitchSummary(row: PitchRow, images: readonly PlaceImageRow[] = []): PublicPitch | null {
  const currency = pitchRentalCurrency(row.currency);
  if (row.hourlyRateMinor === null || currency === null) return null;
  return {
    id: row.id,
    summary: row.summary,
    hourlyRateMinor: row.hourlyRateMinor,
    currency,
    place: canonicalPlaceSummary(row.place, images),
  };
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
    const byPlace = groupCanonicalPlaceImages(images);
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

  async suggestPlace(
    userId: string,
    input: PitchPlaceSuggestionInput,
  ): Promise<PitchPlaceSuggestionResult> {
    return this.db.$transaction(async (tx) => {
      const result = await suggestCanonicalPlace(tx, userId, input.place, "FANHUB");
      if (result.outcome === "EXISTING") return result;

      await tx.placeCapability.create({
        data: {
          placeId: result.place.id,
          kind: "PITCH",
          status: "PENDING",
          hourlyRateMinor: input.pitch.hourlyRateMinor,
          currency: input.pitch.currency,
        },
      });
      return result;
    });
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

  async pending(): Promise<readonly PitchReviewQueueItem[]> {
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
              ...canonicalPlaceSelect,
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
          place: { select: canonicalPlaceSelect },
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
    const byPlace = groupCanonicalPlaceImages(images);

    const initial: PitchReviewQueueItem[] = initialRows
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
        place: canonicalPlaceSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));

    const revisions: PitchReviewQueueItem[] = revisionRows
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
        place: canonicalPlaceSummary(row.place, byPlace.get(row.place.id) ?? []),
      }));

    return [...initial, ...revisions].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  async review(
    actorUserId: string,
    target: PitchReviewTarget,
    reviewId: string,
    input: ModerationDecisionInput,
  ) {
    return target === "INITIAL_SUGGESTION"
      ? this.reviewInitialSuggestion(actorUserId, reviewId, input)
      : this.reviewOwnerRevision(actorUserId, reviewId, input);
  }

  private async reviewInitialSuggestion(
    actorUserId: string,
    capabilityId: string,
    input: ModerationDecisionInput,
  ) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    return this.db.$transaction(async (tx) => {
      const pitch = await tx.placeCapability.findFirst({
        where: {
          id: capabilityId,
          kind: "PITCH",
          status: "PENDING",
          place: { moderationStatus: "PENDING", archivedAt: null },
        },
        select: { placeId: true, hourlyRateMinor: true, currency: true },
      });
      if (!pitch) return false;
      if (
        status === "APPROVED" &&
        (pitch.hourlyRateMinor === null || pitchRentalCurrency(pitch.currency) === null)
      ) {
        throw new Error("PITCH_PRICING_REQUIRED");
      }

      const reviewedAt = new Date();
      const capabilityResult = await tx.placeCapability.updateMany({
        where: { id: capabilityId, kind: "PITCH", status: "PENDING" },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!capabilityResult.count) return false;

      const placeResult = await tx.place.updateMany({
        where: { id: pitch.placeId, moderationStatus: "PENDING", archivedAt: null },
        data: {
          moderationStatus: status,
          reviewedByUserId: actorUserId,
          reviewedAt,
          reviewNote: input.note ?? null,
        },
      });
      if (!placeResult.count) throw new Error("PITCH_INITIAL_PLACE_STATE_CHANGED");

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `PITCH_INITIAL_SUGGESTION_${status}`,
          entityType: "PlaceCapability",
          entityId: capabilityId,
          metadata: { placeId: pitch.placeId, kind: "PITCH", note: input.note ?? null },
        },
      });
      return true;
    });
  }

  private async reviewOwnerRevision(
    actorUserId: string,
    applicationId: string,
    input: ModerationDecisionInput,
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
