import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MediaProcessingRequestImageProcessor } from "../apps/api/src/modules/requests/infrastructure/media-processing-request-image-processor.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

const processor = new MediaProcessingRequestImageProcessor();

test("Request image processor uses the PHOTO_STANDARD master output and rejects spoofing", async () => {
  const png = new Uint8Array(
    await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  );

  const processed = await processor.process(png, "image/png");
  assert.deepEqual(processed.selectedVariants, ["master"]);
  assert.equal(processed.variants.length, 1);
  assert.equal(processed.variants[0]?.contentType, "image/webp");
  const metadata = await sharp(processed.variants[0]!.body).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);

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
