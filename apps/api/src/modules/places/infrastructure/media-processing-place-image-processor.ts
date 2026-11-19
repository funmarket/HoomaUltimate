import { PLACE_IMAGE_MAX_BYTES, type PlaceImageContentType } from "@hooma/contracts/places";
import {
  MediaProcessingError,
  PHOTO_STANDARD,
  processMedia,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import type { PlaceImageProcessor } from "../application/place-image-processor.js";
import { PlaceMediaError } from "../domain/place-media-error.js";

export class MediaProcessingPlaceImageProcessor implements PlaceImageProcessor {
  async process(
    body: Uint8Array,
    contentType: PlaceImageContentType,
  ): Promise<ProcessedMediaResult> {
    try {
      return await processMedia({
        body,
        contentType,
        profile: PHOTO_STANDARD,
        requestedVariants: ["master"],
        maxInputBytes: PLACE_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      if (!(error instanceof MediaProcessingError)) throw error;
      throw new PlaceMediaError(
        "PLACE_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP Place photo up to 40 megapixels.",
      );
    }
  }
}
