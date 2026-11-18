import {
  MediaProcessingError,
  PHOTO_STANDARD,
  processMedia,
  type ProcessedMediaResult,
} from "@hooma/media-processing";
import { REQUEST_IMAGE_MAX_BYTES, type RequestImageContentType } from "@hooma/contracts/requests";
import type { RequestImageProcessor } from "../application/request-image-processor.js";
import { RequestError } from "../domain/request-error.js";

export class MediaProcessingRequestImageProcessor implements RequestImageProcessor {
  async process(
    body: Uint8Array,
    contentType: RequestImageContentType,
  ): Promise<ProcessedMediaResult> {
    try {
      return await processMedia({
        body,
        contentType,
        profile: PHOTO_STANDARD,
        requestedVariants: ["master"],
        maxInputBytes: REQUEST_IMAGE_MAX_BYTES,
      });
    } catch (error) {
      if (!(error instanceof MediaProcessingError)) throw error;
      throw new RequestError(
        "REQUEST_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP image up to 40 megapixels.",
      );
    }
  }
}
