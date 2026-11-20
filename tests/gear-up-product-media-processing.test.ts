import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { GEAR_UP_PRODUCT_IMAGE_MAX_BYTES } from "@hooma/contracts/gear-up";
import { GearUpError } from "../apps/api/src/modules/gear-up/domain/gear-up-error.js";
import { MediaProcessingGearUpProductImageProcessor } from "../apps/api/src/modules/gear-up/infrastructure/media-processing-gear-up-product-image-processor.js";

function expectGearUpTypeInvalid(error: unknown) {
  return error instanceof GearUpError && error.code === "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID";
}

test("Gear Up shared processor supports JPEG, PNG and WebP as master only", async () => {
  const processor = new MediaProcessingGearUpProductImageProcessor();
  for (const [format, contentType] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const) {
    const input = new Uint8Array(
      await sharp({
        create: { width: 64, height: 32, channels: 3, background: "#6699cc" },
      })
        .toFormat(format)
        .toBuffer(),
    );
    const result = await processor.process(input, contentType);
    assert.equal(result.profile, "PHOTO_STANDARD");
    assert.deepEqual(result.selectedVariants, ["master"]);
    assert.deepEqual(result.variants.map(({ variant }) => variant), ["master"]);
    assert.equal(result.variants[0]?.contentType, "image/webp");
    assert.equal((await sharp(result.variants[0]!.body).metadata()).format, "webp");
  }
});

test("Gear Up processor rejects mismatched, invalid, oversized and excessive pixels", async () => {
  const processor = new MediaProcessingGearUpProductImageProcessor();
  const validPng = new Uint8Array(
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );
  await assert.rejects(() => processor.process(validPng, "image/jpeg"), expectGearUpTypeInvalid);
  await assert.rejects(
    () => processor.process(Uint8Array.of(1, 2, 3), "image/png"),
    expectGearUpTypeInvalid,
  );
  await assert.rejects(
    () => processor.process(new Uint8Array(GEAR_UP_PRODUCT_IMAGE_MAX_BYTES + 1), "image/png"),
    expectGearUpTypeInvalid,
  );
  const excessive = new Uint8Array(
    await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );
  await assert.rejects(() => processor.process(excessive, "image/png"), expectGearUpTypeInvalid);
});
