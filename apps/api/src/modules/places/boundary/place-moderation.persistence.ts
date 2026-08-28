import type { Prisma } from "@hooma/database";
import type { PlaceModerationDecision } from "../application/place.repository.js";

export async function reviewPendingPlace(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  placeId: string,
  input: PlaceModerationDecision,
  reviewedAt = new Date(),
): Promise<boolean> {
  const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const result = await tx.place.updateMany({
    where: { id: placeId, moderationStatus: "PENDING", archivedAt: null },
    data: {
      moderationStatus: status,
      reviewedByUserId: actorUserId,
      reviewedAt,
      reviewNote: input.note ?? null,
    },
  });
  return result.count > 0;
}
