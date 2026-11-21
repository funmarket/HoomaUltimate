import { athletesCalendarMediaCleanupPayloadSchema } from "@hooma/contracts/athletes";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function isSafeIdentifier(value: string): boolean {
  return SAFE_IDENTIFIER.test(value) && !value.includes("..");
}

export function createAthletesCalendarMediaCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  mediaStorageScope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = athletesCalendarMediaCleanupPayloadSchema.parse(event.payload);
    const identifiersAreSafe =
      isSafeIdentifier(payload.athletesCommunityId) && isSafeIdentifier(payload.mediaId);
    const legacyObjectKey = identifiersAreSafe
      ? `athletes-calendar-media/${payload.athletesCommunityId}/${payload.mediaId}`
      : null;
    const typedObjectKey = identifiersAreSafe
      ? buildMediaObjectKey({
          scope: mediaStorageScope,
          namespace: "ATHLETES_CALENDAR",
          ownerId: payload.athletesCommunityId,
          mediaId: payload.mediaId,
          variant: "master",
        })
      : null;
    if (
      event.id !== payload.mediaId ||
      (payload.objectKey !== legacyObjectKey && payload.objectKey !== typedObjectKey)
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
