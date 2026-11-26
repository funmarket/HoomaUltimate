import {
  MediaProcessingError,
  PHOTO_STANDARD,
  planMediaObjectKeys,
  type MediaStorageScope,
} from "@hooma/media-processing";

export type AthletesIdentitySlot = "logo" | "banner";

export interface AthletesIdentityUploadIntent {
  readonly athletesCommunityId: string;
  readonly mediaId: string;
  readonly slot: AthletesIdentitySlot;
  readonly objectKey: string;
}

export interface AthletesIdentityAdoption extends AthletesIdentityUploadIntent {
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface AthletesIdentityPublicMedia {
  readonly mediaId: string;
  readonly objectKey: string;
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface AthletesIdentityMediaRepository {
  prepareIdentityUpload(input: AthletesIdentityUploadIntent): Promise<void>;
  adoptPreparedIdentity(userId: string, input: AthletesIdentityAdoption): Promise<void>;
  readPublicIdentityMedia(
    athletesCommunityId: string,
    slot: AthletesIdentitySlot,
  ): Promise<AthletesIdentityPublicMedia | null>;
}

export function planAthletesIdentityMasterKey(
  scope: MediaStorageScope,
  athletesCommunityId: string,
  mediaId: string,
  slot: AthletesIdentitySlot,
): string {
  const planned = planMediaObjectKeys({
    scope,
    namespace: slot === "logo" ? "ATHLETES_COMMUNITY_LOGO" : "ATHLETES_COMMUNITY_BANNER",
    ownerId: athletesCommunityId,
    mediaId,
    profile: PHOTO_STANDARD,
    requestedVariants: ["master"],
  });
  if (planned.length !== 1 || planned[0]?.variant !== "master") {
    throw new MediaProcessingError(
      "VARIANT_SET_MISMATCH",
      "Athletes identity media must have exactly the master variant",
    );
  }
  return planned[0].objectKey;
}
