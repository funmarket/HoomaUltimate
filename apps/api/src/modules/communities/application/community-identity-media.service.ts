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
import { CommunityIdentityMediaError } from "../domain/community-identity-media-error.js";
import type { CommunityService } from "./community.service.js";
import {
  planCommunityIdentityMasterKey,
  type CommunityIdentityMediaRepository,
  type CommunityIdentitySlot,
} from "./community-identity-media.repository.js";

export interface CommunityIdentityImageProcessor {
  process(body: Uint8Array, contentType: MediaInputContentType): Promise<ProcessedMediaResult>;
}

export class CommunityIdentityMediaService {
  constructor(
    private readonly communities: Pick<CommunityService, "assertCanManageIdentityMedia">,
    private readonly repository: CommunityIdentityMediaRepository,
    private readonly storage: ObjectStorage | null,
    private readonly scope: MediaStorageScope | null,
    private readonly processor: CommunityIdentityImageProcessor,
  ) {}

  async contentPublic(
    communityId: string,
    slot: CommunityIdentitySlot,
  ): Promise<{ readonly body: Uint8Array; readonly contentType: "image/webp" }> {
    if (!this.storage || !this.scope) {
      throw new CommunityIdentityMediaError(
        503,
        "COMMUNITY_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    const media = await this.repository.readPublicIdentityMedia(communityId, slot);
    if (!media) {
      throw new CommunityIdentityMediaError(
        404,
        "COMMUNITY_IDENTITY_MEDIA_NOT_FOUND",
        "HOOMA image not found",
      );
    }
    let exactKey: string;
    try {
      exactKey = planCommunityIdentityMasterKey(this.scope, communityId, media.mediaId, slot);
    } catch {
      throw new CommunityIdentityMediaError(
        404,
        "COMMUNITY_IDENTITY_MEDIA_NOT_FOUND",
        "HOOMA image not found",
      );
    }
    if (media.objectKey !== exactKey || media.contentType !== "image/webp") {
      throw new CommunityIdentityMediaError(
        404,
        "COMMUNITY_IDENTITY_MEDIA_NOT_FOUND",
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
        throw new Error("Community media descriptor mismatch");
      }
      return { body: stored.body, contentType: "image/webp" };
    } catch {
      throw new CommunityIdentityMediaError(
        503,
        "COMMUNITY_IDENTITY_MEDIA_UNAVAILABLE",
        "HOOMA image is unavailable",
      );
    }
  }

  async upload(
    userId: string,
    communityId: string,
    slot: CommunityIdentitySlot,
    input: { readonly body: Uint8Array; readonly contentType: string },
  ): Promise<{ mediaId: string }> {
    await this.communities.assertCanManageIdentityMedia(userId, communityId);
    if (!this.storage || !this.scope) {
      throw new CommunityIdentityMediaError(
        503,
        "COMMUNITY_IDENTITY_MEDIA_NOT_CONFIGURED",
        "HOOMA media storage is not configured",
      );
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.contentType)) {
      throw new CommunityIdentityMediaError(
        400,
        "COMMUNITY_IDENTITY_MEDIA_TYPE_INVALID",
        "Invalid image type",
      );
    }
    if (!input.body.byteLength || input.body.byteLength > DEFAULT_INTENDED_HTTP_MAX_BYTES) {
      throw new CommunityIdentityMediaError(
        413,
        "COMMUNITY_IDENTITY_MEDIA_SIZE_INVALID",
        "Invalid image byte size",
      );
    }
    const contentType = input.contentType as MediaInputContentType;
    let processed: ProcessedMediaResult;
    try {
      processed = await this.processor.process(input.body, contentType);
    } catch (error) {
      if (error instanceof MediaProcessingError) {
        throw new CommunityIdentityMediaError(
          415,
          "COMMUNITY_IDENTITY_MEDIA_TYPE_INVALID",
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
      throw new CommunityIdentityMediaError(
        422,
        "COMMUNITY_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image variants",
      );
    }
    const mediaId = randomUUID();
    const objectKey = planCommunityIdentityMasterKey(this.scope, communityId, mediaId, slot);
    const identity = {
      scope: this.scope,
      namespace: slot === "logo" ? ("COMMUNITY_LOGO" as const) : ("COMMUNITY_BANNER" as const),
      ownerId: communityId,
      mediaId,
    };
    await this.repository.prepareIdentityUpload({ communityId, mediaId, slot, objectKey });
    let written;
    try {
      written = await writeMediaVariants({
        storage: this.storage,
        identity,
        processed,
      });
    } catch (error) {
      if (error instanceof MediaVariantWriteError) {
        throw new CommunityIdentityMediaError(
          503,
          "COMMUNITY_IDENTITY_MEDIA_UPLOAD_FAILED",
          "HOOMA image upload failed",
        );
      }
      throw error;
    }
    const master = written.descriptors[0];
    if (written.descriptors.length !== 1 || !master || master.objectKey !== objectKey) {
      throw new CommunityIdentityMediaError(
        422,
        "COMMUNITY_IDENTITY_MEDIA_VARIANTS_INVALID",
        "Invalid image output",
      );
    }
    await this.communities.assertCanManageIdentityMedia(userId, communityId);
    await this.repository.adoptPreparedIdentity({
      communityId,
      mediaId,
      slot,
      objectKey,
      contentType: master.contentType,
      sizeBytes: master.sizeBytes,
    });
    return { mediaId };
  }
}
