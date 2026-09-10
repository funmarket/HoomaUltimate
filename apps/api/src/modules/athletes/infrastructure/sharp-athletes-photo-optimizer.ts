import sharp from "sharp";
import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";
import type {
  AthletesOptimizedPhoto,
  AthletesPhotoOptimizer,
} from "../application/athletes-photo-optimizer.js";
import { AthletesError } from "../domain/athletes-error.js";

const ATHLETES_PHOTO_MAX_EDGE_PX = 1600;
const ATHLETES_PHOTO_WEBP_QUALITY = 82;

export class SharpAthletesPhotoOptimizer implements AthletesPhotoOptimizer {
  async optimize(
    body: Uint8Array,
    contentType: AthletesPhotoContentType,
  ): Promise<AthletesOptimizedPhoto> {
    try {
      const image = sharp(body, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== contentType) throw new Error("Image format mismatch");

      const optimized = await image
        .rotate()
        .resize({
          width: ATHLETES_PHOTO_MAX_EDGE_PX,
          height: ATHLETES_PHOTO_MAX_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: ATHLETES_PHOTO_WEBP_QUALITY, effort: 4 })
        .toBuffer();

      if (!optimized.byteLength) throw new Error("Optimized image is empty");
      return { body: optimized, contentType: "image/webp" };
    } catch {
      throw new AthletesError(
        "ATHLETES_PHOTO_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP photo up to 40 megapixels.",
      );
    }
  }
}
