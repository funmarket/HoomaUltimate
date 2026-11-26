import { randomUUID } from "node:crypto";
import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  MediaProcessingError,
  MediaVariantWriteError,
  PHOTO_STANDARD,
  writeMediaVariants,
  type MediaInputContentType,
  type MediaNamespace,
  type MediaStorageScope,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import { AthletesIdentityMediaError } from "../domain/athletes-identity-media-error.js";
import type { AthletesFounderContentAuthorizer } from "./athletes-content-authorizer.js";
import {
  planAthletesIdentityMasterKey,
  type AthletesIdentityMediaRepository,
  type AthletesIdentitySlot,
} from "./athletes-identity-media.repository.js";

export interface AthletesIdentityImageProcessor {
  process(body: Uint8Array, contentType: MediaInputContentType): Promise<ProcessedMediaResult>;
}

export class AthletesIdentityMediaService {
  constructor(
    private readonly communities: AthletesFounderContentAuthorizer,
    private readonly repository: AthletesIdentityMediaRepository,
    private readonly storage: ObjectStorage | null,
    private readonly scope: MediaStorageScope | null,
    private readonly processor: AthletesIdentityImageProcessor,
  ) {}

  async contentPublic(
    athletesCommunityId: string,
    slot: AthletesIdentitySlot,
  ): Promise<{ readonly body: Uint8Array; readonly contentType: "image/webp" }> {
    if (!this.storage || !this.scope) {
      throw new AthletesIdentityMediaError(
        503,
        "ATHLETES_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    const media = await this.repository.readPublicIdentityMedia(athletesCommunityId, slot);
    if (!media) {
      throw new AthletesIdentityMediaError(
        404,
        "ATHLETES_IDENTITY_MEDIA_NOT_FOUND",
        "Athletes image not found",
      );
    }
    let exactKey: string;
    try {
      exactKey = planAthletesIdentityMasterKey(
        this.scope,
        athletesCommunityId,
        media.mediaId,
        slot,
      );
    } catch {
      throw new AthletesIdentityMediaError(
        404,
        "ATHLETES_IDENTITY_MEDIA_NOT_FOUND",
        "Athletes image not found",
      );
    }
    if (media.objectKey !== exactKey || media.contentType !== "image/webp") {
      throw new AthletesIdentityMediaError(
        404,
        "ATHLETES_IDENTITY_MEDIA_NOT_FOUND",
        "Athletes image not found",
      );
    }
    try {
      const stored = await this.storage.get(exactKey);
      if (
        stored.contentType !== "image/webp" ||
        stored.sizeBytes !== media.sizeBytes ||
        stored.body.byteLength !== media.sizeBytes
      ) {
        throw new Error("Community media descriptor mismatch");
      }
      return { body: stored.body, contentType: "image/webp" };
    } catch {
      throw new AthletesIdentityMediaError(
        503,
        "ATHLETES_IDENTITY_MEDIA_UNAVAILABLE",
        "Athletes image is unavailable",
      );
    }
  }

  async upload(
    userId: string,
    athletesCommunityId: string,
    slot: AthletesIdentitySlot,
    input: { readonly body: Uint8Array; readonly contentType: string },
  ): Promise<{ mediaId: string }> {
    await this.communities.requireFounderContent(userId, athletesCommunityId);
    if (!this.storage || !this.scope) {
      throw new AthletesIdentityMediaError(
        503,
        "ATHLETES_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.contentType)) {
      throw new AthletesIdentityMediaError(
        400,
        "ATHLETES_IDENTITY_MEDIA_TYPE_INVALID",
        "Invalid image type",
      );
    }
    if (!input.body.byteLength || input.body.byteLength > DEFAULT_INTENDED_HTTP_MAX_BYTES) {
      throw new AthletesIdentityMediaError(
        413,
        "ATHLETES_IDENTITY_MEDIA_SIZE_INVALID",
        "Invalid image byte size",
      );
    }
    const contentType = input.contentType as MediaInputContentType;
    let processed: ProcessedMediaResult;
    try {
      processed = await this.processor.process(input.body, contentType);
    } catch (error) {
      if (error instanceof MediaProcessingError) {
        throw new AthletesIdentityMediaError(
          415,
          "ATHLETES_IDENTITY_MEDIA_TYPE_INVALID",
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
      throw new AthletesIdentityMediaError(
        422,
        "ATHLETES_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image variants",
      );
    }
    const mediaId = randomUUID();
    const objectKey = planAthletesIdentityMasterKey(this.scope, athletesCommunityId, mediaId, slot);
    const namespace: MediaNamespace =
      slot === "logo" ? "ATHLETES_COMMUNITY_LOGO" : "ATHLETES_COMMUNITY_BANNER";
    const identity = {
      scope: this.scope,
      namespace,
      ownerId: athletesCommunityId,
      mediaId,
    };
    await this.repository.prepareIdentityUpload({ athletesCommunityId, mediaId, slot, objectKey });
    let written;
    try {
      written = await writeMediaVariants({
        storage: this.storage,
        identity,
        processed,
      });
    } catch (error) {
      if (error instanceof MediaVariantWriteError) {
        throw new AthletesIdentityMediaError(
          503,
          "ATHLETES_IDENTITY_MEDIA_UPLOAD_FAILED",
          "Athletes image upload failed",
        );
      }
      throw error;
    }
    const master = written.descriptors[0];
    if (written.descriptors.length !== 1 || !master || master.objectKey !== objectKey) {
      throw new AthletesIdentityMediaError(
        422,
        "ATHLETES_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image output",
      );
    }
    await this.communities.requireFounderContent(userId, athletesCommunityId);
    await this.repository.adoptPreparedIdentity(userId, {
      athletesCommunityId,
      mediaId,
      slot,
      objectKey,
      contentType: master.contentType,
      sizeBytes: master.sizeBytes,
    });
    return { mediaId };
  }
}
