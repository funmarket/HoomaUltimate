import type { PrismaClient } from "@hooma/database";
import {
  ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC,
  athletesIdentityMediaCleanupPayloadSchema,
} from "@hooma/contracts/athletes";
import type {
  AthletesIdentityAdoption,
  AthletesIdentityMediaRepository,
  AthletesIdentitySlot,
  AthletesIdentityUploadIntent,
} from "../application/athletes-identity-media.repository.js";
import { AthletesContentAuthorization } from "../application/athletes-content-authorizer.js";
import { AthletesError } from "../domain/athletes-error.js";
import { PrismaAthletesRepository } from "./prisma-athletes.repository.js";

export class PrismaAthletesIdentityMediaRepository implements AthletesIdentityMediaRepository {
  constructor(private readonly db: PrismaClient) {}

  async prepareIdentityUpload(input: AthletesIdentityUploadIntent): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        id: input.mediaId,
        topic: ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC,
        aggregateType: "AthletesIdentityMedia",
        aggregateId: input.athletesCommunityId,
        payload: {
          athletesCommunityId: input.athletesCommunityId,
          mediaId: input.mediaId,
          slot: input.slot,
          objectKey: input.objectKey,
        },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  async adoptPreparedIdentity(userId: string, input: AthletesIdentityAdoption): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "AthletesCommunity" WHERE "id" = ${input.athletesCommunityId} FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new AthletesError("ATHLETES_NOT_FOUND", "Athletes community not found");
      }
      const authorization = new AthletesContentAuthorization(new PrismaAthletesRepository(tx));
      await authorization.requireFounderContent(userId, input.athletesCommunityId);
      const now = new Date();
      const intent = await tx.outboxEvent.findUnique({ where: { id: input.mediaId } });
      if (
        !intent ||
        intent.topic !== ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC ||
        intent.aggregateType !== "AthletesIdentityMedia" ||
        intent.aggregateId !== input.athletesCommunityId ||
        intent.status !== "PENDING" ||
        intent.claimedAt !== null ||
        intent.availableAt <= now
      ) {
        throw new Error("Athletes identity upload preparation is missing or expired");
      }
      const payload = athletesIdentityMediaCleanupPayloadSchema.parse(intent.payload);
      if (
        payload.athletesCommunityId !== input.athletesCommunityId ||
        payload.mediaId !== input.mediaId ||
        payload.slot !== input.slot ||
        payload.objectKey !== input.objectKey
      ) {
        throw new Error("Athletes identity upload prepared key does not match");
      }
      const current = await tx.athletesCommunity.findUniqueOrThrow({
        where: { id: input.athletesCommunityId },
        select: {
          logoMediaId: true,
          logoObjectKey: true,
          bannerMediaId: true,
          bannerObjectKey: true,
        },
      });
      const consumed = await tx.outboxEvent.deleteMany({
        where: {
          id: input.mediaId,
          topic: ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC,
          aggregateId: input.athletesCommunityId,
          status: "PENDING",
          claimedAt: null,
          availableAt: { gt: now },
        },
      });
      if (consumed.count !== 1) throw new Error("Athletes identity upload was already claimed");
      const newMedia = {
        ...(input.slot === "logo"
          ? {
              logoMediaId: input.mediaId,
              logoObjectKey: input.objectKey,
              logoContentType: input.contentType,
              logoSizeBytes: input.sizeBytes,
            }
          : {
              bannerUrl: null,
              bannerMediaId: input.mediaId,
              bannerObjectKey: input.objectKey,
              bannerContentType: input.contentType,
              bannerSizeBytes: input.sizeBytes,
            }),
      };
      await tx.athletesCommunity.update({
        where: { id: input.athletesCommunityId },
        data: newMedia,
      });
      const oldMediaId = input.slot === "logo" ? current.logoMediaId : current.bannerMediaId;
      const oldObjectKey = input.slot === "logo" ? current.logoObjectKey : current.bannerObjectKey;
      if (oldMediaId && oldObjectKey && oldMediaId !== input.mediaId) {
        await tx.outboxEvent.create({
          data: {
            id: oldMediaId,
            topic: ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC,
            aggregateType: "AthletesIdentityMedia",
            aggregateId: input.athletesCommunityId,
            payload: {
              athletesCommunityId: input.athletesCommunityId,
              mediaId: oldMediaId,
              slot: input.slot,
              objectKey: oldObjectKey,
            },
          },
        });
      }
    });
  }

  async readPublicIdentityMedia(athletesCommunityId: string, slot: AthletesIdentitySlot) {
    const row = await this.db.athletesCommunity.findFirst({
      where: { id: athletesCommunityId, status: "ACTIVE" },
      select: {
        logoUrl: true,
        logoMediaId: true,
        logoObjectKey: true,
        logoContentType: true,
        logoSizeBytes: true,
        bannerUrl: true,
        bannerMediaId: true,
        bannerObjectKey: true,
        bannerContentType: true,
        bannerSizeBytes: true,
      },
    });
    if (!row) return null;
    const mediaId = slot === "logo" ? row.logoMediaId : row.bannerMediaId;
    const objectKey = slot === "logo" ? row.logoObjectKey : row.bannerObjectKey;
    const contentType = slot === "logo" ? row.logoContentType : row.bannerContentType;
    const sizeBytes = slot === "logo" ? row.logoSizeBytes : row.bannerSizeBytes;
    if (!mediaId || !objectKey || contentType !== "image/webp") {
      return null;
    }
    if (!sizeBytes || sizeBytes <= 0) return null;
    return { mediaId, objectKey, contentType: "image/webp" as const, sizeBytes };
  }
}
