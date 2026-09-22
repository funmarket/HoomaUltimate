import sharp from "sharp";
import type { RequestImageValidator } from "../application/request-image-validator.js";
import { RequestError } from "../domain/request-error.js";

/**
 * Requests-owned image byte validation built on the repository's existing image
 * library. It deliberately does not reuse or import the Athletes-owned validator
 * (that service belongs to another domain), and it stores through the canonical
 * `@hooma/storage` port like every other HOOMA media path.
 */
export class SharpRequestImageValidator implements RequestImageValidator {
  async validate(body: Uint8Array, contentType: string): Promise<void> {
    try {
      const image = sharp(body, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (!metadata.format) throw new Error("Image format is not readable");
      if (`image/${metadata.format}` !== contentType) throw new Error("Image format mismatch");
      // Headers alone prove nothing. Decoding the pixels rejects truncated,
      // corrupt or content-type-spoofed uploads.
      await image.stats();
    } catch {
      throw new RequestError(
        "REQUEST_IMAGE_TYPE_INVALID",
        "Choose a valid JPEG, PNG or WebP photo",
      );
    }
  }
}
