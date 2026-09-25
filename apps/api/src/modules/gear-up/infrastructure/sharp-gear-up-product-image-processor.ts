import sharp from "sharp";
import type { GearUpProductImageContentType } from "@hooma/contracts/gear-up";
import type {
  GearUpProductImageProcessor,
  ProcessedGearUpProductImage,
} from "../application/gear-up-product-image-processor.js";
import { GearUpError } from "../domain/gear-up-error.js";

const PRODUCT_IMAGE_MAX_EDGE_PX = 1600;
const PRODUCT_IMAGE_WEBP_QUALITY = 82;

export class SharpGearUpProductImageProcessor implements GearUpProductImageProcessor {
  async process(
    body: Uint8Array,
    contentType: GearUpProductImageContentType,
  ): Promise<ProcessedGearUpProductImage> {
    try {
      const image = sharp(body, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== contentType) {
        throw new Error("Image format mismatch");
      }
      await image.stats();
      const optimized = await image
        .rotate()
        .resize({
          width: PRODUCT_IMAGE_MAX_EDGE_PX,
          height: PRODUCT_IMAGE_MAX_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: PRODUCT_IMAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();
      if (!optimized.byteLength) throw new Error("Optimized image is empty");
      return { body: optimized, contentType: "image/webp" };
    } catch {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP product image up to 40 megapixels.",
      );
    }
  }
}
