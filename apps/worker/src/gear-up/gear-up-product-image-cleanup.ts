import { gearUpProductImageCleanupPayloadSchema } from "@hooma/contracts/gear-up";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

interface GearUpProductImageCleanupDatabase {
  readonly gearUpProductImage: {
    findFirst(input: {
      readonly where: { readonly objectKey: string };
      readonly select: { readonly id: true };
    }): Promise<{ readonly id: string } | null>;
  };
}

export function createGearUpProductImageCleanupHandler(
  database: GearUpProductImageCleanupDatabase,
  storage: Pick<ObjectStorage, "remove">,
  mediaStorageScope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = gearUpProductImageCleanupPayloadSchema.parse(event.payload);
    if (!isOwnedGearUpProductKey(payload.productId, payload.objectKey, mediaStorageScope)) {
      throw new Error(
        "Gear Up product image cleanup key is outside the Gear Up product ownership boundary",
      );
    }
    const image = await database.gearUpProductImage.findFirst({
      where: { objectKey: payload.objectKey },
      select: { id: true },
    });
    if (!image) await storage.remove(payload.objectKey);
  };
}

function isOwnedGearUpProductKey(
  productId: string,
  objectKey: string,
  mediaStorageScope: MediaStorageScope,
): boolean {
  const legacyPrefix = `gear-up-product-images/${productId}/`;
  if (objectKey.startsWith(legacyPrefix)) {
    const imageId = objectKey.slice(legacyPrefix.length);
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(imageId) && !imageId.includes("..");
  }
  const typedPrefix = `${mediaStorageScope}/media/v1/gear-up-product/${productId}/`;
  if (!objectKey.startsWith(typedPrefix)) return false;
  const match = /^([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/master\.webp$/.exec(
    objectKey.slice(typedPrefix.length),
  );
  if (!match) return false;
  try {
    return (
      buildMediaObjectKey({
        scope: mediaStorageScope,
        namespace: "GEAR_UP_PRODUCT",
        ownerId: productId,
        mediaId: match[1]!,
        variant: "master",
      }) === objectKey
    );
  } catch {
    return false;
  }
}
