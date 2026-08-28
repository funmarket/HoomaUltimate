import type { PitchSuggestionInput } from "@hooma/contracts/pitch";
import { Prisma } from "@hooma/database";
import type { PitchModerationDecision } from "../application/pitch.repository.js";

function validCurrency(value: string | null): boolean {
  return value === "TND" || value === "EUR" || value === "USD";
}

export async function createPendingPitchCapability(
  tx: Prisma.TransactionClient,
  placeId: string,
  input: PitchSuggestionInput,
): Promise<void> {
  await tx.placeCapability.create({
    data: {
      placeId,
      kind: "PITCH",
      status: "PENDING",
      hourlyRateMinor: input.hourlyRateMinor,
      currency: input.currency,
    },
  });
}

export async function reviewPendingInitialPitch(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  capabilityId: string,
  input: PitchModerationDecision,
): Promise<{ placeId: string } | null> {
  const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const pitch = await tx.placeCapability.findFirst({
    where: { id: capabilityId, kind: "PITCH", status: "PENDING" },
    select: { placeId: true, hourlyRateMinor: true, currency: true },
  });
  if (!pitch) return null;
  if (status === "APPROVED" && (pitch.hourlyRateMinor === null || !validCurrency(pitch.currency))) {
    throw new Error("PITCH_PRICING_REQUIRED");
  }

  const reviewedAt = new Date();
  const result = await tx.placeCapability.updateMany({
    where: { id: capabilityId, kind: "PITCH", status: "PENDING" },
    data: {
      status,
      reviewedByUserId: actorUserId,
      reviewedAt,
      reviewNote: input.note ?? null,
    },
  });
  if (!result.count) return null;

  await tx.auditLog.create({
    data: {
      actorUserId,
      action: `PITCH_INITIAL_SUGGESTION_${status}`,
      entityType: "PlaceCapability",
      entityId: capabilityId,
      metadata: { placeId: pitch.placeId, kind: "PITCH", note: input.note ?? null },
    },
  });
  return { placeId: pitch.placeId };
}
