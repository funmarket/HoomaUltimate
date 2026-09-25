import sharp from "sharp";
import type { RequestImageContentType } from "@hooma/contracts/requests";
import type {
  ProcessedRequestImage,
  RequestImageProcessor,
} from "../application/request-image-processor.js";
import { RequestError } from "../domain/request-error.js";

const REQUEST_IMAGE_MAX_EDGE_PX = 1600;
const REQUEST_IMAGE_WEBP_QUALITY = 82;

export class SharpRequestImageProcessor implements RequestImageProcessor {
  async process(
    body: Uint8Array,
    contentType: RequestImageContentType,
  ): Promise<ProcessedRequestImage> {
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
          width: REQUEST_IMAGE_MAX_EDGE_PX,
          height: REQUEST_IMAGE_MAX_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: REQUEST_IMAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();
      if (!optimized.byteLength) throw new Error("Optimized image is empty");
      return { body: optimized, contentType: "image/webp" };
    } catch {
      throw new RequestError(
        "REQUEST_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP image up to 40 megapixels.",
      );
    }
  }
}
