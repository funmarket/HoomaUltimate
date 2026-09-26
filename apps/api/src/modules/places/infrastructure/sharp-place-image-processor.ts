import sharp from "sharp";
import type { PlaceImageContentType } from "@hooma/contracts/places";
import { AppError } from "../../../http/errors/app-error.js";
import type {
  PlaceImageProcessor,
  ProcessedPlaceImage,
} from "../application/place-image-processor.js";

const PLACE_IMAGE_MAX_EDGE_PX = 1600;
const PLACE_IMAGE_WEBP_QUALITY = 82;

export class SharpPlaceImageProcessor implements PlaceImageProcessor {
  async process(
    body: Uint8Array,
    contentType: PlaceImageContentType,
  ): Promise<ProcessedPlaceImage> {
    try {
      const image = sharp(body, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== contentType) throw new Error("Image format mismatch");
      await image.stats();
      const optimized = await image
        .rotate()
        .resize({
          width: PLACE_IMAGE_MAX_EDGE_PX,
          height: PLACE_IMAGE_MAX_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: PLACE_IMAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();
      if (!optimized.byteLength) throw new Error("Optimized image is empty");
      return { body: optimized, contentType: "image/webp" };
    } catch {
      throw new AppError(
        422,
        "PLACE_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP Place photo up to 40 megapixels.",
      );
    }
  }
}
