import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  PHOTO_STANDARD,
  processMedia,
  type MediaInputContentType,
  type ProcessedMediaResult,
} from "@hooma/media-processing";

export { planAthletesIdentityMasterKey } from "../application/athletes-identity-media.repository.js";
export type { AthletesIdentitySlot } from "../application/athletes-identity-media.repository.js";

export class AthletesIdentityImageProcessor {
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
