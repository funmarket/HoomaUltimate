// What this does: persists Team badge/banner upload intents and managed descriptors.
// Key invariant: a Team slot has either an external URL or one exact managed object, never both.
// Explicitly out of scope: Team lifecycle, roster, and presentation policy.
import type { PrismaClient } from "@hooma/database";
import {
  TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC,
  teamIdentityMediaCleanupPayloadSchema,
} from "@hooma/contracts/teams";
import type {
  TeamIdentityAdoption,
  TeamIdentityMediaRepository,
  TeamIdentitySlot,
  TeamIdentityUploadIntent,
} from "../application/team-identity-media.repository.js";

export class PrismaTeamIdentityMediaRepository implements TeamIdentityMediaRepository {
  constructor(private readonly db: PrismaClient) {}
  async prepareIdentityUpload(input: TeamIdentityUploadIntent): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id: input.mediaId,
        topic: TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC,
        aggregateType: "TeamIdentityMedia",
        aggregateId: input.teamId,
        payload: {
          teamId: input.teamId,
          mediaId: input.mediaId,
          slot: input.slot,
          objectKey: input.objectKey,
        },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }
  async adoptPreparedIdentity(input: TeamIdentityAdoption): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Team" WHERE "id" = ${input.teamId} FOR UPDATE`;
      if (locked.length !== 1) throw new Error("Team no longer exists");
      const now = new Date();
      const intent = await tx.outboxEvent.findUnique({ where: { id: input.mediaId } });
      if (
        !intent ||
        intent.topic !== TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC ||
        intent.aggregateType !== "TeamIdentityMedia" ||
        intent.aggregateId !== input.teamId ||
        intent.status !== "PENDING" ||
        intent.claimedAt !== null ||
        intent.availableAt <= now
      )
        throw new Error("Team identity upload preparation is missing or expired");
      const payload = teamIdentityMediaCleanupPayloadSchema.parse(intent.payload);
      if (
        payload.teamId !== input.teamId ||
        payload.mediaId !== input.mediaId ||
        payload.slot !== input.slot ||
        payload.objectKey !== input.objectKey
      )
        throw new Error("Team identity upload prepared key does not match");
      const current = await tx.team.findUniqueOrThrow({
        where: { id: input.teamId },
        select: {
          badgeMediaId: true,
          badgeObjectKey: true,
          bannerMediaId: true,
          bannerObjectKey: true,
        },
      });
      const consumed = await tx.outboxEvent.deleteMany({
        where: {
          id: input.mediaId,
          topic: TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC,
          aggregateId: input.teamId,
          status: "PENDING",
          claimedAt: null,
          availableAt: { gt: now },
        },
      });
      if (consumed.count !== 1) throw new Error("Team identity upload was already claimed");
      await tx.team.update({
        where: { id: input.teamId },
        data:
          input.slot === "badge"
            ? {
                badgeUrl: null,
                badgeMediaId: input.mediaId,
                badgeObjectKey: input.objectKey,
                badgeContentType: input.contentType,
                badgeSizeBytes: input.sizeBytes,
              }
            : {
                bannerUrl: null,
                bannerMediaId: input.mediaId,
                bannerObjectKey: input.objectKey,
                bannerContentType: input.contentType,
                bannerSizeBytes: input.sizeBytes,
              },
      });
      const oldMediaId = input.slot === "badge" ? current.badgeMediaId : current.bannerMediaId;
      const oldObjectKey =
        input.slot === "badge" ? current.badgeObjectKey : current.bannerObjectKey;
      if (oldMediaId && oldObjectKey && oldMediaId !== input.mediaId)
        await tx.outboxEvent.create({
          data: {
            id: oldMediaId,
            topic: TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC,
            aggregateType: "TeamIdentityMedia",
            aggregateId: input.teamId,
            payload: {
              teamId: input.teamId,
              mediaId: oldMediaId,
              slot: input.slot,
              objectKey: oldObjectKey,
            },
          },
        });
    });
  }
  async readPublicIdentityMedia(teamId: string, slot: TeamIdentitySlot) {
    const row = await this.db.team.findFirst({
      where: {
        id: teamId,
        status: "ACTIVE",
        OR: [{ communityId: null }, { community: { visibility: "PUBLIC" } }],
      },
      select: {
        badgeUrl: true,
        badgeMediaId: true,
        badgeObjectKey: true,
        badgeContentType: true,
        badgeSizeBytes: true,
        bannerUrl: true,
        bannerMediaId: true,
        bannerObjectKey: true,
        bannerContentType: true,
        bannerSizeBytes: true,
      },
    });
    if (!row) return null;
    const externalUrl = slot === "badge" ? row.badgeUrl : row.bannerUrl;
    const mediaId = slot === "badge" ? row.badgeMediaId : row.bannerMediaId;
    const objectKey = slot === "badge" ? row.badgeObjectKey : row.bannerObjectKey;
    const contentType = slot === "badge" ? row.badgeContentType : row.bannerContentType;
    const sizeBytes = slot === "badge" ? row.badgeSizeBytes : row.bannerSizeBytes;
    return externalUrl === null &&
      mediaId &&
      objectKey &&
      contentType === "image/webp" &&
      sizeBytes &&
      sizeBytes > 0
      ? { mediaId, objectKey, contentType: "image/webp" as const, sizeBytes }
      : null;
  }
}
