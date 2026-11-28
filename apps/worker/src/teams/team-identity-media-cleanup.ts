import {
  TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC,
  teamIdentityMediaCleanupPayloadSchema,
} from "@hooma/contracts/teams";
import type { PrismaClient } from "@hooma/database";
import { buildMediaObjectKey, type MediaStorageScope } from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function createTeamIdentityMediaCleanupHandler(
  database: PrismaClient,
  storage: Pick<ObjectStorage, "remove">,
  scope: MediaStorageScope,
): OutboxHandler {
  return async (event) => {
    const payload = teamIdentityMediaCleanupPayloadSchema.parse(event.payload);
    const reject = () => {
      throw new Error("Team media cleanup key is outside the Team identity ownership boundary");
    };
    if (
      event.topic !== TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC ||
      event.id !== payload.mediaId ||
      !SAFE_ID.test(payload.teamId) ||
      !SAFE_ID.test(payload.mediaId) ||
      payload.teamId.includes("..") ||
      payload.mediaId.includes("..")
    ) {
      return reject();
    }
    let expected: string;
    try {
      expected = buildMediaObjectKey({
        scope,
        namespace: payload.slot === "badge" ? "TEAM_BADGE" : "TEAM_BANNER",
        ownerId: payload.teamId,
        mediaId: payload.mediaId,
        variant: "master",
      });
    } catch {
      return reject();
    }
    if (payload.objectKey !== expected) return reject();

    const reference = await database.team.findFirst({
      where: {
        OR: [
          { badgeMediaId: payload.mediaId },
          { badgeObjectKey: expected },
          { bannerMediaId: payload.mediaId },
          { bannerObjectKey: expected },
        ],
      },
      select: { id: true },
    });
    if (!reference) await storage.remove(expected);
  };
}
