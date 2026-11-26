import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  PHOTO_STANDARD,
  processMedia,
  type MediaInputContentType,
  type ProcessedMediaResult,
} from "@hooma/media-processing";

export { planCommunityIdentityMasterKey } from "../application/community-identity-media.repository.js";
export type { CommunityIdentitySlot } from "../application/community-identity-media.repository.js";

export class CommunityIdentityImageProcessor {
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
