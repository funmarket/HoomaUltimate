// What this does: validates, processes, stores, and adopts Team badge/banner uploads.
// Key invariant: only an authorized Team editor can replace one exact managed master image.
// Explicitly out of scope: Team creation, roster, and match behavior.
import { randomUUID } from "node:crypto";
import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  MediaProcessingError,
  MediaVariantWriteError,
  PHOTO_STANDARD,
  writeMediaVariants,
  type MediaInputContentType,
  type MediaStorageScope,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import { TeamIdentityMediaError } from "../domain/team-identity-media-error.js";
import type { TeamService } from "./team.service.js";
import {
  planTeamIdentityMasterKey,
  type TeamIdentityMediaRepository,
  type TeamIdentitySlot,
} from "./team-identity-media.repository.js";

export interface TeamIdentityImageProcessor {
  process(body: Uint8Array, contentType: MediaInputContentType): Promise<ProcessedMediaResult>;
}

export class TeamIdentityMediaService {
  constructor(
    private readonly teams: Pick<TeamService, "assertCanManageIdentityMedia">,
    private readonly repository: TeamIdentityMediaRepository,
    private readonly storage: ObjectStorage | null,
    private readonly scope: MediaStorageScope | null,
    private readonly processor: TeamIdentityImageProcessor,
  ) {}

  async contentPublic(
    teamId: string,
    slot: TeamIdentitySlot,
  ): Promise<{ readonly body: Uint8Array; readonly contentType: "image/webp" }> {
    if (!this.storage || !this.scope) {
      throw new TeamIdentityMediaError(
        503,
        "TEAM_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    const media = await this.repository.readPublicIdentityMedia(teamId, slot);
    if (!media) {
      throw new TeamIdentityMediaError(
        404,
        "TEAM_IDENTITY_MEDIA_NOT_FOUND",
        "HOOMA image not found",
      );
    }
    let exactKey: string;
    try {
      exactKey = planTeamIdentityMasterKey(this.scope, teamId, media.mediaId, slot);
    } catch {
      throw new TeamIdentityMediaError(
        404,
        "TEAM_IDENTITY_MEDIA_NOT_FOUND",
        "HOOMA image not found",
      );
    }
    if (media.objectKey !== exactKey || media.contentType !== "image/webp") {
      throw new TeamIdentityMediaError(
        404,
        "TEAM_IDENTITY_MEDIA_NOT_FOUND",
        "HOOMA image not found",
      );
    }
    try {
      const stored = await this.storage.get(exactKey);
      if (
        stored.contentType !== "image/webp" ||
        stored.sizeBytes !== media.sizeBytes ||
        stored.body.byteLength !== media.sizeBytes
      ) {
        throw new Error("Team media descriptor mismatch");
      }
      return { body: stored.body, contentType: "image/webp" };
    } catch {
      throw new TeamIdentityMediaError(
        503,
        "TEAM_IDENTITY_MEDIA_UNAVAILABLE",
        "HOOMA image is unavailable",
      );
    }
  }

  async upload(
    userId: string,
    teamId: string,
    slot: TeamIdentitySlot,
    input: { readonly body: Uint8Array; readonly contentType: string },
  ): Promise<{ mediaId: string }> {
    await this.teams.assertCanManageIdentityMedia(userId, teamId);
    if (!this.storage || !this.scope) {
      throw new TeamIdentityMediaError(
        503,
        "TEAM_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.contentType)) {
      throw new TeamIdentityMediaError(
        400,
        "TEAM_IDENTITY_MEDIA_TYPE_INVALID",
        "Invalid image type",
      );
    }
    if (!input.body.byteLength || input.body.byteLength > DEFAULT_INTENDED_HTTP_MAX_BYTES) {
      throw new TeamIdentityMediaError(
        413,
        "TEAM_IDENTITY_MEDIA_SIZE_INVALID",
        "Invalid image byte size",
      );
    }
    const contentType = input.contentType as MediaInputContentType;
    let processed: ProcessedMediaResult;
    try {
      processed = await this.processor.process(input.body, contentType);
    } catch (error) {
      if (error instanceof MediaProcessingError) {
        throw new TeamIdentityMediaError(
          415,
          "TEAM_IDENTITY_MEDIA_TYPE_INVALID",
          "Choose a valid JPEG, PNG, or WebP image within the approved limits",
        );
      }
      throw error;
    }
    if (
      processed.profile !== PHOTO_STANDARD.id ||
      processed.selectedVariants?.length !== 1 ||
      processed.selectedVariants[0] !== "master" ||
      processed.variants.length !== 1 ||
      processed.variants[0]?.variant !== "master" ||
      processed.variants[0]?.contentType !== "image/webp"
    ) {
      throw new TeamIdentityMediaError(
        422,
        "TEAM_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image variants",
      );
    }
    const mediaId = randomUUID();
    const objectKey = planTeamIdentityMasterKey(this.scope, teamId, mediaId, slot);
    const identity = {
      scope: this.scope,
      namespace: slot === "badge" ? ("TEAM_BADGE" as const) : ("TEAM_BANNER" as const),
      ownerId: teamId,
      mediaId,
    };
    await this.repository.prepareIdentityUpload({ teamId, mediaId, slot, objectKey });
    let written;
    try {
      written = await writeMediaVariants({
        storage: this.storage,
        identity,
        processed,
      });
    } catch (error) {
      if (error instanceof MediaVariantWriteError) {
        throw new TeamIdentityMediaError(
          503,
          "TEAM_IDENTITY_MEDIA_UPLOAD_FAILED",
          "HOOMA image upload failed",
        );
      }
      throw error;
    }
    const master = written.descriptors[0];
    if (written.descriptors.length !== 1 || !master || master.objectKey !== objectKey) {
      throw new TeamIdentityMediaError(
        422,
        "TEAM_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image output",
      );
    }
    await this.teams.assertCanManageIdentityMedia(userId, teamId);
    await this.repository.adoptPreparedIdentity({
      teamId,
      mediaId,
      slot,
      objectKey,
      contentType: master.contentType,
      sizeBytes: master.sizeBytes,
    });
    return { mediaId };
  }
}
