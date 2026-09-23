import {
  helpRequestImageCleanupPayloadSchema,
} from "@hooma/contracts/requests";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createRequestImageCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
): OutboxHandler {
  return async (event) => {
    const payload = helpRequestImageCleanupPayloadSchema.parse(event.payload);
    if (!payload.objectKey.startsWith(`request-images/${payload.requestId}/`)) {
      throw new Error("Request image cleanup key is outside the Request ownership boundary");
    }
    const image = await database.helpRequestImage.findFirst({
      where: { objectKey: payload.objectKey },
      select: { id: true },
    });
    if (!image) await storage.remove(payload.objectKey);
  };
}
