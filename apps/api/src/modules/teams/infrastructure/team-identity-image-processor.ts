import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  PHOTO_STANDARD,
  processMedia,
  type MediaInputContentType,
  type ProcessedMediaResult,
} from "@hooma/media-processing";

export { planTeamIdentityMasterKey } from "../application/team-identity-media.repository.js";
export type { TeamIdentitySlot } from "../application/team-identity-media.repository.js";

export class TeamIdentityImageProcessor {
  process(body: Uint8Array, contentType: MediaInputContentType): Promise<ProcessedMediaResult> {
    return processMedia({
      body,
      contentType,
      profile: PHOTO_STANDARD,
      requestedVariants: ["master"],
      maxInputBytes: DEFAULT_INTENDED_HTTP_MAX_BYTES,
    });
  }
}
