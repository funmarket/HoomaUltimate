import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpRequestImageProcessor } from "../apps/api/src/modules/requests/infrastructure/sharp-request-image-processor.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

const processor = new SharpRequestImageProcessor();

test("Request image processor decodes actual bytes, rejects spoofing, and emits bounded WebP", async () => {
  const png = new Uint8Array(
    await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );

  const processed = await processor.process(png, "image/png");
  assert.equal(processed.contentType, "image/webp");
  const metadata = await sharp(processed.body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);

  await assert.rejects(
    () => processor.process(png, "image/jpeg"),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
  await assert.rejects(
    () => processor.process(new TextEncoder().encode("not an image"), "image/png"),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_IMAGE_TYPE_INVALID",
  );
});
