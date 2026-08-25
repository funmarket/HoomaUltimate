import type {
  AdminQueueItem,
  ModerationDecisionInput,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import type { PrismaClient } from "@hooma/database";
import type { PlaceCapabilityRepository } from "../application/place-capability.repository.js";

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

export class PrismaPlaceCapabilityRepository implements PlaceCapabilityRepository {
  constructor(private readonly db: PrismaClient) {}

  async listApproved(kind: PlaceCapabilityKind): Promise<readonly PublicPlaceCapability[]> {
    const rows = await this.db.placeCapabilityApplication.findMany({
      where: { kind, status: "APPROVED", place: { moderationStatus: "APPROVED" } },
      select: { id: true, kind: true, summary: true, place: { select: placeSelect } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      summary: row.summary,
      place: placeSummary(row.place),
    }));
  }

  async submit(
    userId: string,
    placeId: string,
    kind: PlaceCapabilityKind,
    input: PlaceCapabilityApplicationInput,
  ) {
    return this.db.placeCapabilityApplication.upsert({
      where: { placeId_kind: { placeId, kind } },
      create: {
        placeId,
        applicantUserId: userId,
        kind,
        summary: input.summary,
        contactName: input.contactName,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
      },
      update: {
        applicantUserId: userId,
        summary: input.summary,
        contactName: input.contactName,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        status: "PENDING",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
      },
      select: { id: true, status: true },
    });
  }

  async pending(kind: PlaceCapabilityKind): Promise<readonly AdminQueueItem[]> {
    const rows = await this.db.placeCapabilityApplication.findMany({
      where: { kind, status: "PENDING" },
      select: {
        id: true,
        kind: true,
        status: true,
        summary: true,
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
    return rows
      .filter((row) => row.applicant.presentation)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        applicant: {
          userId: row.applicant.id,
          username: row.applicant.presentation!.username,
          displayName: row.applicant.presentation!.displayName,
        },
        place: placeSummary(row.place),
      }));
  }

  async review(
    actorUserId: string,
    applicationId: string,
    kind: PlaceCapabilityKind,
    input: ModerationDecisionInput,
  ) {
    const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await this.db.$transaction(async (tx) => {
      const application = await tx.placeCapabilityApplication.findFirstOrThrow({
        where: { id: applicationId, kind },
        select: { placeId: true },
      });
      await tx.placeCapabilityApplication.update({
        where: { id: applicationId },
        data: {
          status,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: `${kind}_APPLICATION_${status}`,
          entityType: "PlaceCapabilityApplication",
          entityId: applicationId,
          metadata: { placeId: application.placeId, kind, note: input.note ?? null },
        },
      });
    });
  }
}
