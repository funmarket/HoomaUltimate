import { athletesPhotoCleanupPayloadSchema } from "@hooma/contracts/athletes";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createAthletesPhotoCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  mediaStorageScope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = athletesPhotoCleanupPayloadSchema.parse(event.payload);
    const legacyObjectKey = `athletes-photos/${payload.athletesCommunityId}/${payload.photoId}`;
    const typedObjectKey = buildMediaObjectKey({
      scope: mediaStorageScope,
      namespace: "ATHLETES_PHOTO",
      ownerId: payload.athletesCommunityId,
      mediaId: payload.photoId,
      variant: "master",
    });
    if (
      event.id !== payload.photoId ||
      (payload.objectKey !== legacyObjectKey && payload.objectKey !== typedObjectKey)
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
