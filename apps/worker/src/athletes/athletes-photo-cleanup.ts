import { athletesPhotoCleanupPayloadSchema } from "@hooma/contracts/athletes";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createAthletesPhotoCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
): OutboxHandler {
  return async (event) => {
    const payload = athletesPhotoCleanupPayloadSchema.parse(event.payload);
    if (
      event.id !== payload.photoId ||
      payload.objectKey !== `athletes-photos/${payload.athletesCommunityId}/${payload.photoId}`
    ) {
      throw new Error("Athletes cleanup key is outside the upload ownership boundary");
    }
    // An existing durable photo is never deleted by orphan reconciliation.
    const photo = await database.athletesPhoto.findFirst({
      where: { OR: [{ id: payload.photoId }, { objectKey: payload.objectKey }] },
      select: { id: true },
    });
    if (!photo) await storage.remove(payload.objectKey);
  };
}
