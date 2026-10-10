import {
  placeImageCleanupPayloadSchema,
  placeImageObjectKey,
  placeManagedImagePath,
} from "@hooma/contracts/places";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createPlaceImageCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
): OutboxHandler {
  return async (event) => {
    const payload = placeImageCleanupPayloadSchema.parse(event.payload);
    if (
      event.id !== payload.imageId ||
      payload.objectKey !== placeImageObjectKey(payload.placeId, payload.imageId)
    ) {
      throw new Error("Place image cleanup key is outside the upload ownership boundary");
    }
    const image = await database.placeImage.findFirst({
      where: {
        OR: [
          { id: payload.imageId },
          { imageUrl: placeManagedImagePath(payload.placeId, payload.imageId) },
        ],
      },
      select: { id: true },
    });
    if (!image) await storage.remove(payload.objectKey);
  };
}
