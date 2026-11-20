import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { GEAR_UP_PRODUCT_IMAGE_MAX_BYTES } from "@hooma/contracts/gear-up";
import { GearUpError } from "../apps/api/src/modules/gear-up/domain/gear-up-error.js";
import { MediaProcessingGearUpProductImageProcessor } from "../apps/api/src/modules/gear-up/infrastructure/media-processing-gear-up-product-image-processor.js";

function expectGearUpTypeInvalid(error: unknown) {
  const code = "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID";
  return error instanceof GearUpError && error.code === code;
}

test("Gear Up processor selects only the PHOTO_STANDARD master", async () => {
  const processor = new MediaProcessingGearUpProductImageProcessor();
  const png = new Uint8Array(
    await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#6699cc" },
    })
      .png()
      .toBuffer(),
  );
  const result = await processor.process(png, "image/png");
  assert.equal(result.profile, "PHOTO_STANDARD");
  assert.deepEqual(result.selectedVariants, ["master"]);
  assert.deepEqual(result.variants.map(({ variant }) => variant), ["master"]);
  assert.equal(result.variants[0]?.contentType, "image/webp");
  const metadata = await sharp(result.variants[0]!.body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
});

test("Gear Up processor accepts JPEG and WebP inputs", async () => {
  const processor = new MediaProcessingGearUpProductImageProcessor();
  const raw = sharp({
    create: { width: 64, height: 32, channels: 3, background: "#6699cc" },
  });
  const jpeg = new Uint8Array(await raw.clone().jpeg().toBuffer());
  const webp = new Uint8Array(await raw.clone().webp().toBuffer());
  const jpegResult = await processor.process(jpeg, "image/jpeg");
  const webpResult = await processor.process(webp, "image/webp");
  assert.deepEqual(jpegResult.selectedVariants, ["master"]);
  assert.deepEqual(webpResult.selectedVariants, ["master"]);
  assert.equal(jpegResult.variants[0]?.contentType, "image/webp");
  assert.equal(webpResult.variants[0]?.contentType, "image/webp");
});

test("Gear Up processor maps invalid media to the existing error", async () => {
  const processor = new MediaProcessingGearUpProductImageProcessor();
  const png = new Uint8Array(
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );
  await assert.rejects(processor.process(png, "image/jpeg"), expectGearUpTypeInvalid);
  await assert.rejects(
    processor.process(Uint8Array.of(1, 2, 3), "image/png"),
    expectGearUpTypeInvalid,
  );
  await assert.rejects(
    processor.process(new Uint8Array(GEAR_UP_PRODUCT_IMAGE_MAX_BYTES + 1), "image/png"),
    expectGearUpTypeInvalid,
  );
  const excessive = new Uint8Array(
    await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );
  await assert.rejects(processor.process(excessive, "image/png"), expectGearUpTypeInvalid);
});
