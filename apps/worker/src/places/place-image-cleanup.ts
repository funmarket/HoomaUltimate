import {
  placeImageCleanupPayloadSchema,
  placeImageObjectKey,
  placeManagedImagePath,
} from "@hooma/contracts/places";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createPlaceImageCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  mediaStorageScope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = placeImageCleanupPayloadSchema.parse(event.payload);
    if (
      event.id !== payload.imageId ||
      !isPlaceImageObjectKey(payload.placeId, payload.imageId, payload.objectKey, mediaStorageScope)
    ) {
      throw new Error("Place image cleanup key is outside the upload ownership boundary");
    }
    const image = await database.placeImage.findFirst({
      where: {
        OR: [
          { objectKey: payload.objectKey },
          { id: payload.imageId, placeId: payload.placeId },
          {
            placeId: payload.placeId,
            imageUrl: placeManagedImagePath(payload.placeId, payload.imageId),
          },
        ],
      },
      select: { id: true },
    });
    if (!image) await storage.remove(payload.objectKey);
  };
}

function isPlaceImageObjectKey(
  placeId: string,
  imageId: string,
  objectKey: string,
  mediaStorageScope: MediaStorageScope,
): boolean {
  if (objectKey === placeImageObjectKey(placeId, imageId)) return true;
  try {
    return (
      buildMediaObjectKey({
        scope: mediaStorageScope,
        namespace: "PLACE_PHOTO",
        ownerId: placeId,
        mediaId: imageId,
        variant: "master",
      }) === objectKey
    );
  } catch {
    return false;
  }
}
