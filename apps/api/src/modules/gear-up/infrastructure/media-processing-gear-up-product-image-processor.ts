import {
  MediaProcessingError,
  PHOTO_STANDARD,
  processMedia,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import {
  GEAR_UP_PRODUCT_IMAGE_MAX_BYTES,
  type GearUpProductImageContentType,
} from "@hooma/contracts/gear-up";
import type { GearUpProductImageProcessor } from "../application/gear-up-product-image-processor.js";
import { GearUpError } from "../domain/gear-up-error.js";

export class MediaProcessingGearUpProductImageProcessor implements GearUpProductImageProcessor {
  async process(
    body: Uint8Array,
    contentType: GearUpProductImageContentType,
  ): Promise<ProcessedMediaResult> {
    try {
      return await processMedia({
        body,
        contentType,
        profile: PHOTO_STANDARD,
        requestedVariants: ["master"],
        maxInputBytes: GEAR_UP_PRODUCT_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      if (!(error instanceof MediaProcessingError)) throw error;
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP product image up to 40 megapixels.",
      );
    }
  }
}
