import {
  MediaProcessingError,
  PHOTO_STANDARD,
  planMediaObjectKeys,
  type MediaStorageScope,
} from "@hooma/media-processing";

export type CommunityIdentitySlot = "logo" | "banner";

export interface CommunityIdentityUploadIntent {
  readonly communityId: string;
  readonly mediaId: string;
  readonly slot: CommunityIdentitySlot;
  readonly objectKey: string;
}

export interface CommunityIdentityAdoption extends CommunityIdentityUploadIntent {
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface CommunityIdentityPublicMedia {
  readonly mediaId: string;
  readonly objectKey: string;
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface CommunityIdentityMediaRepository {
  prepareIdentityUpload(input: CommunityIdentityUploadIntent): Promise<void>;
  adoptPreparedIdentity(input: CommunityIdentityAdoption): Promise<void>;
  readPublicIdentityMedia(
    communityId: string,
    slot: CommunityIdentitySlot,
  ): Promise<CommunityIdentityPublicMedia | null>;
}

export function planCommunityIdentityMasterKey(
  scope: MediaStorageScope,
  communityId: string,
  mediaId: string,
  slot: CommunityIdentitySlot,
): string {
  const planned = planMediaObjectKeys({
    scope,
    namespace: slot === "logo" ? "COMMUNITY_LOGO" : "COMMUNITY_BANNER",
    ownerId: communityId,
    mediaId,
    profile: PHOTO_STANDARD,
    requestedVariants: ["master"],
  });
  if (planned.length !== 1 || planned[0]?.variant !== "master") {
    throw new MediaProcessingError(
      "VARIANT_SET_MISMATCH",
      "Community identity media must have exactly the master variant",
    );
  }
  return planned[0].objectKey;
}
