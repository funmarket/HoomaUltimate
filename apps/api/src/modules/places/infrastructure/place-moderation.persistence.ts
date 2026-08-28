import { Prisma } from "@hooma/database";
import type { PlaceModerationDecision } from "../application/place.repository.js";

export async function reviewPendingPlace(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  placeId: string,
  input: PlaceModerationDecision,
): Promise<boolean> {
  const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
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
}
