import { gearUpProductImageCleanupPayloadSchema } from "@hooma/contracts/gear-up";
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
): OutboxHandler {
  return async (event) => {
    const payload = gearUpProductImageCleanupPayloadSchema.parse(event.payload);
    if (!payload.objectKey.startsWith(`gear-up-product-images/${payload.productId}/`)) {
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
