import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";
import { MediaProcessingAthletesPhotoOptimizer } from "../apps/api/src/modules/athletes/infrastructure/media-processing-athletes-photo-optimizer.js";

const optimizer = new MediaProcessingAthletesPhotoOptimizer();

async function raster(format: "jpeg" | "png" | "webp", width: number, height: number) {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: "#6699cc" } })
      .toFormat(format)
      .toBuffer(),
  );
}

function expectPhotoTypeInvalid(error: unknown) {
  return error instanceof AthletesError && error.code === "ATHLETES_PHOTO_TYPE_INVALID";
}

test("A1 media-processing adapter normalizes JPEG PNG and WebP to the master WebP variant", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const contentType = ("image/" + format) as "image/jpeg" | "image/png" | "image/webp";
    const result = await optimizer.optimize(await raster(format, 2400, 1200), contentType);
    const metadata = await sharp(result.body).metadata();
    assert.equal(result.contentType, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 2048);
    assert.equal(metadata.height, 1024);
  }
});

test("A1 media-processing adapter maps corrupt and spoofed media back to Athletes errors", async () => {
  await assert.rejects(
    () => optimizer.optimize(Uint8Array.of(1, 2, 3), "image/jpeg"),
    expectPhotoTypeInvalid,
  );
  const png = await raster("png", 32, 32);
  await assert.rejects(() => optimizer.optimize(png, "image/jpeg"), expectPhotoTypeInvalid);
});

test("A1 media-processing adapter rejects decoded images above 40 megapixels", async () => {
  const overLimit = await raster("png", 6401, 6250);
  await assert.rejects(() => optimizer.optimize(overLimit, "image/png"), expectPhotoTypeInvalid);
});

test("A1 media-processing adapter normalizes EXIF orientation and strips metadata", async () => {
  const oriented = new Uint8Array(
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#cc8844" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );
  const result = await optimizer.optimize(oriented, "image/jpeg");
  const metadata = await sharp(result.body).metadata();
  assert.equal(metadata.width, 20);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.xmp, undefined);
});

test("A1 media-processing adapter never enlarges a small source", async () => {
  const result = await optimizer.optimize(await raster("png", 320, 160), "image/png");
  const metadata = await sharp(result.body).metadata();
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 160);
});
