import { ATHLETES_PHOTO_MAX_BYTES, type AthletesPhotoContentType } from "@hooma/contracts/athletes";
import {
  MediaProcessingError,
  PHOTO_STANDARD,
  processMedia,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import type { AthletesCalendarMediaProcessor } from "../application/athletes-calendar-media-processor.js";
import { AthletesError } from "../domain/athletes-error.js";

export class MediaProcessingAthletesCalendarMediaProcessor implements AthletesCalendarMediaProcessor {
  async process(
    body: Uint8Array,
    contentType: AthletesPhotoContentType,
  ): Promise<ProcessedMediaResult> {
    try {
      return await processMedia({
        body,
        contentType,
        profile: PHOTO_STANDARD,
        requestedVariants: ["master"],
        maxInputBytes: ATHLETES_PHOTO_MAX_BYTES,
      });
    } catch (error) {
      if (!(error instanceof MediaProcessingError)) throw error;
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP event photo up to 40 megapixels.",
      );
    }
  }
}
