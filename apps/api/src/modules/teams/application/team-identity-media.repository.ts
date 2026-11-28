import {
  MediaProcessingError,
  PHOTO_STANDARD,
  planMediaObjectKeys,
  type MediaStorageScope,
} from "@hooma/media-processing";

export type TeamIdentitySlot = "badge" | "banner";

export interface TeamIdentityUploadIntent {
  readonly teamId: string;
  readonly mediaId: string;
  readonly slot: TeamIdentitySlot;
  readonly objectKey: string;
}

export interface TeamIdentityAdoption extends TeamIdentityUploadIntent {
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface TeamIdentityPublicMedia {
  readonly mediaId: string;
  readonly objectKey: string;
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
}

export interface TeamIdentityMediaRepository {
  prepareIdentityUpload(input: TeamIdentityUploadIntent): Promise<void>;
  adoptPreparedIdentity(input: TeamIdentityAdoption): Promise<void>;
  readPublicIdentityMedia(
    teamId: string,
    slot: TeamIdentitySlot,
  ): Promise<TeamIdentityPublicMedia | null>;
}

export function planTeamIdentityMasterKey(
  scope: MediaStorageScope,
  teamId: string,
  mediaId: string,
  slot: TeamIdentitySlot,
): string {
  const planned = planMediaObjectKeys({
    scope,
    namespace: slot === "badge" ? "TEAM_BADGE" : "TEAM_BANNER",
    ownerId: teamId,
    mediaId,
    profile: PHOTO_STANDARD,
    requestedVariants: ["master"],
  });
  if (planned.length !== 1 || planned[0]?.variant !== "master") {
    throw new MediaProcessingError(
      "VARIANT_SET_MISMATCH",
      "Team identity media must have exactly the master variant",
    );
  }
  return planned[0].objectKey;
}
