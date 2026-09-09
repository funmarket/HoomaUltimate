import sharp from "sharp";
import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";
import type { AthletesPhotoValidator } from "../application/athletes-photo-validator.js";
import { AthletesError } from "../domain/athletes-error.js";

export class SharpAthletesPhotoValidator implements AthletesPhotoValidator {
  async validate(body: Uint8Array, contentType: AthletesPhotoContentType): Promise<void> {
    try {
      const image = sharp(body, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (`image/${metadata.format}` !== contentType) throw new Error("Image format mismatch");
      // Metadata alone reads headers. Decode pixels to reject truncated/corrupt uploads.
      await image.stats();
    } catch {
      throw new AthletesError(
        "ATHLETES_PHOTO_TYPE_INVALID",
        "Choose a valid JPEG, PNG, or WebP photo up to 40 megapixels.",
      );
    }
  }
}
