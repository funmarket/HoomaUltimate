import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { GEAR_UP_PRODUCT_IMAGE_MAX_BYTES } from "@hooma/contracts/gear-up";
import { GearUpError } from "../apps/api/src/modules/gear-up/domain/gear-up-error.js";
import { MediaProcessingGearUpProductImageProcessor } from "../apps/api/src/modules/gear-up/infrastructure/media-processing-gear-up-product-image-processor.js";

const processor = new MediaProcessingGearUpProductImageProcessor();

async function imageBody(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: "#ffffff" } });
  return new Uint8Array(await image.toFormat(format).toBuffer());
}

function isInvalidImage(error: unknown): boolean {
  const invalidCode = "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID";
  return error instanceof GearUpError && error.code === invalidCode;
}

test("Gear Up processes PNG with only the shared master variant", async () => {
  const result = await processor.process(await imageBody(2400, 1200, "png"), "image/png");
  assert.equal(result.profile, "PHOTO_STANDARD");
  assert.deepEqual(result.selectedVariants, ["master"]);
  assert.equal(result.variants.length, 1);
  assert.equal(result.variants[0]?.variant, "master");
  assert.equal(result.variants[0]?.contentType, "image/webp");
  const metadata = await sharp(result.variants[0]!.body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
});

test("Gear Up supports JPEG and WebP", async () => {
  const jpeg = await processor.process(await imageBody(64, 32, "jpeg"), "image/jpeg");
  const webp = await processor.process(await imageBody(64, 32, "webp"), "image/webp");
  assert.deepEqual(jpeg.selectedVariants, ["master"]);
  assert.deepEqual(webp.selectedVariants, ["master"]);
  assert.equal(jpeg.variants[0]?.contentType, "image/webp");
  assert.equal(webp.variants[0]?.contentType, "image/webp");
});

test("Gear Up rejects invalid and excessive image inputs", async () => {
  const png = await imageBody(32, 32, "png");
  await assert.rejects(processor.process(png, "image/jpeg"), isInvalidImage);
  await assert.rejects(processor.process(Uint8Array.of(1, 2, 3), "image/png"), isInvalidImage);
  const oversized = new Uint8Array(GEAR_UP_PRODUCT_IMAGE_MAX_BYTES + 1);
  await assert.rejects(processor.process(oversized, "image/png"), isInvalidImage);
  const excessive = await imageBody(8000, 6000, "png");
  await assert.rejects(processor.process(excessive, "image/png"), isInvalidImage);
});
