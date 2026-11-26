import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  MediaProcessingError,
  MediaVariantWriteError,
  writeMediaVariants,
} from "@hooma/media-processing";
import type { ObjectStorage } from "@hooma/storage";
import {
  CommunityIdentityImageProcessor,
  planCommunityIdentityMasterKey,
} from "../apps/api/src/modules/communities/infrastructure/community-identity-image-processor.js";

const processor = new CommunityIdentityImageProcessor();

async function imageBody(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: "#ffffff" } });
  return new Uint8Array(await image.toFormat(format).toBuffer());
}

test("Community logo and banner use exact scoped master keys", () => {
  assert.equal(
    planCommunityIdentityMasterKey("staging", "community-1", "logo-1", "logo"),
    "staging/media/v1/community-logo/community-1/logo-1/master.webp",
  );
  assert.equal(
    planCommunityIdentityMasterKey("development", "community-1", "banner-1", "banner"),
    "development/media/v1/community-banner/community-1/banner-1/master.webp",
  );
  assert.throws(
    () => planCommunityIdentityMasterKey("staging", "../community", "logo-1", "logo"),
    MediaProcessingError,
  );
});

test("Community identity accepts JPEG, PNG and WebP with master-only WebP output", async () => {
  for (const [format, contentType] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const) {
    const processed = await processor.process(await imageBody(64, 32, format), contentType);
    assert.equal(processed.profile, "PHOTO_STANDARD");
    assert.deepEqual(processed.selectedVariants, ["master"]);
    assert.deepEqual(
      processed.variants.map(({ variant }) => variant),
      ["master"],
    );
    assert.equal(processed.variants[0]?.contentType, "image/webp");
    assert.equal((await sharp(processed.variants[0]!.body).metadata()).format, "webp");
  }
});

test("Community identity preserves rotation and the 2048px edge bound", async () => {
  const large = await processor.process(await imageBody(2400, 1200, "png"), "image/png");
  const metadata = await sharp(large.variants[0]!.body).metadata();
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
  const oriented = new Uint8Array(
    await sharp(await imageBody(80, 40, "jpeg"))
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );
  const rotated = await processor.process(oriented, "image/jpeg");
  const dimensions = await sharp(rotated.variants[0]!.body).metadata();
  assert.equal(dimensions.width, 40);
  assert.equal(dimensions.height, 80);
});

test("Community identity rejects corrupt, mismatched, oversized and excess-pixel input", async () => {
  const png = await imageBody(32, 32, "png");
  await assert.rejects(processor.process(png, "image/jpeg"), MediaProcessingError);
  await assert.rejects(
    processor.process(Uint8Array.of(1, 2, 3), "image/png"),
    MediaProcessingError,
  );
  const oversized = new Uint8Array(DEFAULT_INTENDED_HTTP_MAX_BYTES + 1);
  await assert.rejects(processor.process(oversized, "image/png"), MediaProcessingError);
  const excessive = await imageBody(8000, 6000, "png");
  await assert.rejects(processor.process(excessive, "image/png"), MediaProcessingError);
});

test("Community identity writer fails before PUT for wrong variants and rejects storage key mismatch", async () => {
  const processed = await processor.process(await imageBody(32, 32, "png"), "image/png");
  const identity = {
    scope: "staging" as const,
    namespace: "COMMUNITY_LOGO" as const,
    ownerId: "community-1",
    mediaId: "logo-1",
  };
  const written = [];
  const storage = {
    put: async (key: string, body: Uint8Array, contentType: string) => {
      written.push(key);
      return { key: `${key}-other`, contentType, sizeBytes: body.byteLength };
    },
    remove: async () => undefined,
  } as unknown as ObjectStorage;
  await assert.rejects(
    writeMediaVariants({
      storage,
      identity,
      processed: {
        ...processed,
        selectedVariants: ["master", "card"],
      },
    }),
    MediaProcessingError,
  );
  assert.equal(written.length, 0);
  await assert.rejects(
    writeMediaVariants({ storage, identity, processed }),
    MediaVariantWriteError,
  );
  assert.deepEqual(written, ["staging/media/v1/community-logo/community-1/logo-1/master.webp"]);
});
