import {
  COMMUNITY_IDENTITY_MEDIA_RECONCILE_TOPIC,
  communityIdentityMediaCleanupPayloadSchema,
} from "@hooma/contracts/communities";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function createCommunityIdentityMediaCleanupHandler(
  database: PrismaClient,
  storage: Pick<ObjectStorage, "remove">,
  scope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = communityIdentityMediaCleanupPayloadSchema.parse(event.payload);
    const reject = () => {
      throw new Error(
        "Community media cleanup key is outside the Community identity ownership boundary",
      );
    };
    if (
      event.topic !== COMMUNITY_IDENTITY_MEDIA_RECONCILE_TOPIC ||
      event.id !== payload.mediaId ||
      !SAFE_ID.test(payload.communityId) ||
      !SAFE_ID.test(payload.mediaId) ||
      payload.communityId.includes("..") ||
      payload.mediaId.includes("..")
    ) {
      return reject();
    }
    let expected: string;
    try {
      expected = buildMediaObjectKey({
        scope,
        namespace: payload.slot === "logo" ? "COMMUNITY_LOGO" : "COMMUNITY_BANNER",
        ownerId: payload.communityId,
        mediaId: payload.mediaId,
        variant: "master",
      });
    } catch {
      return reject();
    }
    if (payload.objectKey !== expected) return reject();

    const reference = await database.community.findFirst({
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
