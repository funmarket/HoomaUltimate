import { athletesCalendarMediaCleanupPayloadSchema } from "@hooma/contracts/athletes";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createAthletesCalendarMediaCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
): OutboxHandler {
  return async (event) => {
    const payload = athletesCalendarMediaCleanupPayloadSchema.parse(event.payload);
    if (
      event.id !== payload.mediaId ||
      payload.objectKey !==
        `athletes-calendar-media/${payload.athletesCommunityId}/${payload.mediaId}`
    ) {
      throw new Error("Athletes Calendar media cleanup key is outside the ownership boundary");
    }

    const entry = await database.athletesCalendarEntry.findFirst({
      where: {
        athletesCommunityId: payload.athletesCommunityId,
        OR: [{ photoMediaId: payload.mediaId }, { photoObjectKey: payload.objectKey }],
      },
      select: { id: true },
    });
    if (!entry) await storage.remove(payload.objectKey);
  };
}
