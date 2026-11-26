import {
  ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC,
  athletesIdentityMediaCleanupPayloadSchema,
} from "@hooma/contracts/athletes";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function createAthletesIdentityMediaCleanupHandler(
  database: PrismaClient,
  storage: Pick<ObjectStorage, "remove">,
  scope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = athletesIdentityMediaCleanupPayloadSchema.parse(event.payload);
    const reject = () => {
      throw new Error("Athletes identity cleanup key is outside the upload ownership boundary");
    };
    if (
      event.topic !== ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC ||
      event.id !== payload.mediaId ||
      !SAFE_ID.test(payload.athletesCommunityId) ||
      !SAFE_ID.test(payload.mediaId) ||
      payload.athletesCommunityId.includes("..") ||
      payload.mediaId.includes("..")
    ) {
      return reject();
    }
    let expected: string;
    try {
      expected = buildMediaObjectKey({
        scope,
        namespace:
          payload.slot === "logo"
            ? "ATHLETES_COMMUNITY_LOGO"
            : "ATHLETES_COMMUNITY_BANNER",
        ownerId: payload.athletesCommunityId,
        mediaId: payload.mediaId,
        variant: "master",
      });
    } catch {
      return reject();
    }
    if (payload.objectKey !== expected) return reject();

    const reference = await database.athletesCommunity.findFirst({
      where: {
        OR: [
          { logoMediaId: payload.mediaId },
          { logoObjectKey: expected },
          { bannerMediaId: payload.mediaId },
          { bannerObjectKey: expected },
        ],
      },
      select: { id: true },
    });
    if (!reference) await storage.remove(expected);
  };
}
