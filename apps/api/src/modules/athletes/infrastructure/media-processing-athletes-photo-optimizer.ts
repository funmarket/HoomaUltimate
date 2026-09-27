import { MediaProcessingError, PHOTO_STANDARD, processMedia } from "@hooma/media-processing";
import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";
import type {
  AthletesOptimizedPhoto,
  AthletesPhotoOptimizer,
} from "../application/athletes-photo-optimizer.js";
import { AthletesError } from "../domain/athletes-error.js";

export class MediaProcessingAthletesPhotoOptimizer implements AthletesPhotoOptimizer {
  async optimize(
    body: Uint8Array,
    contentType: AthletesPhotoContentType,
  ): Promise<AthletesOptimizedPhoto> {
    try {
      const processed = await processMedia({ body, contentType, profile: PHOTO_STANDARD });
      const master = processed.variants.find(({ variant }) => variant === "master");
      if (!master) {
        throw new MediaProcessingError(
          "VARIANT_SET_MISMATCH",
          "PHOTO_STANDARD did not produce a master variant",
        );
      }
      return { body: master.body, contentType: master.contentType };
    } catch (error) {
      if (error instanceof MediaProcessingError) {
        throw new AthletesError(
          "ATHLETES_PHOTO_TYPE_INVALID",
          "Choose a valid JPEG, PNG, or WebP photo up to 40 megapixels.",
        );
      }
      throw error;
    }
  }
}
