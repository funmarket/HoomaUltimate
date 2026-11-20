import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { ATHLETES_PHOTO_MAX_BYTES } from "@hooma/contracts/athletes";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";
import { MediaProcessingAthletesCalendarMediaProcessor } from "../apps/api/src/modules/athletes/infrastructure/media-processing-athletes-calendar-media-processor.js";

const processor = new MediaProcessingAthletesCalendarMediaProcessor();

async function imageBody(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: "#ffffff" } });
  return new Uint8Array(await image.toFormat(format).toBuffer());
}

function isInvalidCalendarMedia(error: unknown): boolean {
  return error instanceof AthletesError && error.code === "ATHLETES_CALENDAR_MEDIA_TYPE_INVALID";
}

test("Athletes Calendar processes PNG with only the shared master variant", async () => {
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

test("Athletes Calendar supports JPEG and WebP", async () => {
  const jpeg = await processor.process(await imageBody(64, 32, "jpeg"), "image/jpeg");
  const webp = await processor.process(await imageBody(64, 32, "webp"), "image/webp");
  assert.deepEqual(jpeg.selectedVariants, ["master"]);
  assert.deepEqual(webp.selectedVariants, ["master"]);
  assert.equal(jpeg.variants[0]?.contentType, "image/webp");
  assert.equal(webp.variants[0]?.contentType, "image/webp");
});

test("Athletes Calendar rejects invalid, mismatched, oversized, and excessive image inputs", async () => {
  const png = await imageBody(32, 32, "png");
  await assert.rejects(processor.process(png, "image/jpeg"), isInvalidCalendarMedia);
  await assert.rejects(
    processor.process(Uint8Array.of(1, 2, 3), "image/png"),
    isInvalidCalendarMedia,
  );
  await assert.rejects(
    processor.process(new Uint8Array(ATHLETES_PHOTO_MAX_BYTES + 1), "image/png"),
    isInvalidCalendarMedia,
  );
  await assert.rejects(
    processor.process(await imageBody(8000, 6000, "png"), "image/png"),
    isInvalidCalendarMedia,
  );
});
