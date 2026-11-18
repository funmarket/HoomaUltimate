import { helpRequestImageCleanupPayloadSchema } from "@hooma/contracts/requests";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createRequestImageCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  mediaStorageScope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = helpRequestImageCleanupPayloadSchema.parse(event.payload);
    if (!isRequestImageObjectKey(payload.requestId, payload.objectKey, mediaStorageScope)) {
      throw new Error("Request image cleanup key is outside the Request ownership boundary");
    }
    const image = await database.helpRequestImage.findFirst({
      where: { objectKey: payload.objectKey },
      select: { id: true },
    });
    if (!image) await storage.remove(payload.objectKey);
  };
}

function isRequestImageObjectKey(
  requestId: string,
  objectKey: string,
  mediaStorageScope: MediaStorageScope,
): boolean {
  const legacyPrefix = `request-images/${requestId}/`;
  if (objectKey.startsWith(legacyPrefix)) {
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(objectKey.slice(legacyPrefix.length));
  }

  const typedPrefix = `${mediaStorageScope}/media/v1/request-photo/${requestId}/`;
  if (!objectKey.startsWith(typedPrefix)) return false;
  const match = /^([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/master\.webp$/.exec(
    objectKey.slice(typedPrefix.length),
  );
  if (!match) return false;

  try {
    return (
      buildMediaObjectKey({
        scope: mediaStorageScope,
        namespace: "REQUEST_PHOTO",
        ownerId: requestId,
        mediaId: match[1]!,
        variant: "master",
      }) === objectKey
    );
  } catch {
    return false;
  }
}
