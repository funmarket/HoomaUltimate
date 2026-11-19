import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PLACE_IMAGE_MAX_BYTES } from "@hooma/contracts/places";
import { PlaceMediaError } from "../apps/api/src/modules/places/domain/place-media-error.js";

function expectPlaceTypeInvalid(error: unknown) {
  return error instanceof PlaceMediaError && error.code === "PLACE_IMAGE_TYPE_INVALID";
}

test("Place image processing uses only the PHOTO_STANDARD master output", async () => {
  const { MediaProcessingPlaceImageProcessor } =
    await import("../apps/api/src/modules/places/infrastructure/media-processing-place-image-processor.js");
  const processor = new MediaProcessingPlaceImageProcessor();
  const png = new Uint8Array(
    await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#6699cc" },
    })
      .png()
      .toBuffer(),
  );

  const processed = await processor.process(png, "image/png");

  assert.equal(processed.profile, "PHOTO_STANDARD");
  assert.deepEqual(processed.selectedVariants, ["master"]);
  assert.equal(processed.variants.length, 1);
  assert.equal(processed.variants[0]?.variant, "master");
  assert.equal(processed.variants[0]?.contentType, "image/webp");
  const metadata = await sharp(processed.variants[0]!.body).metadata();
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
});

test("Place image processing maps corrupt, spoofed, and oversized input to the existing error", async () => {
  const { MediaProcessingPlaceImageProcessor } =
    await import("../apps/api/src/modules/places/infrastructure/media-processing-place-image-processor.js");
  const processor = new MediaProcessingPlaceImageProcessor();
  const png = new Uint8Array(
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#ffffff" } })
      .png()
      .toBuffer(),
  );

  await assert.rejects(() => processor.process(png, "image/jpeg"), expectPlaceTypeInvalid);
  await assert.rejects(
    () => processor.process(Uint8Array.of(1, 2, 3), "image/png"),
    expectPlaceTypeInvalid,
  );
  await assert.rejects(
    () => processor.process(new Uint8Array(PLACE_IMAGE_MAX_BYTES + 1), "image/png"),
    expectPlaceTypeInvalid,
  );
});
