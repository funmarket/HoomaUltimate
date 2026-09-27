import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  MEDIA_NAMESPACES,
  MediaProcessingError,
  MediaVariantWriteError,
  PAGE_BANNER_STANDARD,
  PHOTO_STANDARD,
  buildMediaObjectKey,
  planMediaObjectKeys,
  processMedia,
  writeMediaVariants,
} from "../packages/media-processing/src/index.js";

const EXPECTED_NAMESPACES = [
  "ATHLETES_PHOTO",
  "ATHLETES_CALENDAR",
  "REQUEST_PHOTO",
  "GEAR_UP_PRODUCT",
  "PLACE_PHOTO",
  "RIDE_VEHICLE",
  "COMMUNITY_LOGO",
  "COMMUNITY_BANNER",
  "ATHLETES_COMMUNITY_LOGO",
  "ATHLETES_COMMUNITY_BANNER",
  "TEAM_BADGE",
  "TEAM_BANNER",
  "PROFILE_AVATAR",
  "WATCH_MEDIA",
  "DONATION_PHOTO",
  "PAGE_BANNER",
] as const;

async function createRaster(
  format: "jpeg" | "png" | "webp",
  width: number,
  height: number,
  background = "#aabbcc",
): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background } })
      .toFormat(format)
      .toBuffer(),
  );
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof MediaProcessingError && error.code === code;
}

test("A0 exposes the complete closed namespace set", () => {
  assert.deepEqual(Object.keys(MEDIA_NAMESPACES), [...EXPECTED_NAMESPACES]);
  assert.equal(MEDIA_NAMESPACES.PLACE_PHOTO, "place-photo");
  assert.equal(MEDIA_NAMESPACES.PAGE_BANNER, "page-banner");
});

test("A0 builds deterministic v1 keys for explicit trusted storage scopes", () => {
  for (const scope of ["production", "staging", "development"] as const) {
    const input = {
      scope,
      namespace: "PLACE_PHOTO" as const,
      ownerId: "place-123",
      mediaId: "media-456",
      variant: "master" as const,
    };
    assert.equal(
      buildMediaObjectKey(input),
      `${scope}/media/v1/place-photo/place-123/media-456/master.webp`,
    );
    assert.equal(buildMediaObjectKey(input), buildMediaObjectKey(input));
  }

  assert.equal(
    buildMediaObjectKey({
      scope: "production",
      namespace: "PAGE_BANNER",
      ownerId: "placement-home",
      mediaId: "media-1",
      variant: "display",
    }),
    "production/media/v1/page-banner/placement-home/media-1/display.webp",
  );
});

test("A0 rejects unknown namespaces, unknown scope, and unsafe identifiers", () => {
  assert.throws(
    () =>
      buildMediaObjectKey({
        scope: "production",
        namespace: "UNKNOWN" as never,
        ownerId: "owner-1",
        mediaId: "media-1",
        variant: "master",
      }),
    (error: unknown) => hasCode(error, "UNKNOWN_NAMESPACE"),
  );
  assert.throws(
    () =>
      buildMediaObjectKey({
        scope: "qa" as never,
        namespace: "PLACE_PHOTO",
        ownerId: "owner-1",
        mediaId: "media-1",
        variant: "master",
      }),
    (error: unknown) => hasCode(error, "UNKNOWN_SCOPE"),
  );
  for (const unsafe of ["", "../evil", "a/b", "..", "abc..def", "a\\b"]) {
    assert.throws(
      () =>
        buildMediaObjectKey({
          scope: "production",
          namespace: "PLACE_PHOTO",
          ownerId: unsafe,
          mediaId: "media-1",
          variant: "master",
        }),
      (error: unknown) => hasCode(error, "UNSAFE_IDENTIFIER"),
    );
  }
});

test("A0 plans non-colliding deterministic variant and media keys", () => {
  const identity = {
    scope: "production" as const,
    namespace: "PLACE_PHOTO" as const,
    ownerId: "place-1",
    mediaId: "media-1",
  };
  const first = planMediaObjectKeys({ ...identity, profile: PHOTO_STANDARD });
  const second = planMediaObjectKeys({ ...identity, profile: PHOTO_STANDARD });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map(({ variant }) => variant),
    ["master", "card", "thumb"],
  );
  assert.equal(new Set(first.map(({ objectKey }) => objectKey)).size, 3);
  const other = planMediaObjectKeys({ ...identity, mediaId: "media-2", profile: PHOTO_STANDARD });
  assert.notEqual(first[0]?.objectKey, other[0]?.objectKey);
});

test("PHOTO_STANDARD publishes the requested bounds and qualities", () => {
  assert.equal(PHOTO_STANDARD.maxDecodedPixels, 40_000_000);
  assert.equal(PHOTO_STANDARD.intendedHttpMaxBytes, 5 * 1024 * 1024);
  assert.deepEqual(PHOTO_STANDARD.acceptedContentTypes, ["image/jpeg", "image/png", "image/webp"]);
  assert.deepEqual(
    PHOTO_STANDARD.variants.map(({ variant, maxEdgePx, quality }) => ({
      variant,
      maxEdgePx,
      quality,
    })),
    [
      { variant: "master", maxEdgePx: 2048, quality: 88 },
      { variant: "card", maxEdgePx: 800, quality: 80 },
      { variant: "thumb", maxEdgePx: 400, quality: 75 },
    ],
  );
});

test("PHOTO_STANDARD accepts JPEG PNG and WebP and emits only normalized WebP variants", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const result = await processMedia({
      body: await createRaster(format, 1200, 600),
      contentType: `image/${format}`,
      profile: PHOTO_STANDARD,
    });
    assert.deepEqual(
      result.variants.map(({ variant }) => variant),
      ["master", "card", "thumb"],
    );
    assert.equal("raw" in result, false);
    assert.equal("sourceBody" in result, false);
    for (const variant of result.variants) {
      assert.equal(variant.contentType, "image/webp");
      assert.equal(variant.sizeBytes, variant.body.byteLength);
      assert.equal((await sharp(variant.body).metadata()).format, "webp");
    }
  }
});

test("A0 rejects empty corrupt unsupported and MIME-spoofed input", async () => {
  await assert.rejects(
    () =>
      processMedia({ body: new Uint8Array(), contentType: "image/jpeg", profile: PHOTO_STANDARD }),
    (error: unknown) => hasCode(error, "EMPTY_INPUT"),
  );

  const jpeg = await createRaster("jpeg", 32, 32);
  const png = await createRaster("png", 32, 32);
  await assert.rejects(
    () =>
      processMedia({
        body: jpeg.subarray(0, 20),
        contentType: "image/jpeg",
        profile: PHOTO_STANDARD,
      }),
    (error: unknown) => hasCode(error, "INVALID_IMAGE"),
  );
  await assert.rejects(
    () =>
      processMedia({
        body: png.subarray(0, 20),
        contentType: "image/png",
        profile: PHOTO_STANDARD,
      }),
    (error: unknown) => hasCode(error, "INVALID_IMAGE"),
  );

  const gif = new Uint8Array(
    Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
  );
  await assert.rejects(
    () =>
      processMedia({
        body: gif,
        contentType: "image/gif" as never,
        profile: PHOTO_STANDARD,
      }),
    (error: unknown) => hasCode(error, "UNSUPPORTED_FORMAT"),
  );
  await assert.rejects(
    () => processMedia({ body: png, contentType: "image/jpeg", profile: PHOTO_STANDARD }),
    (error: unknown) => hasCode(error, "FORMAT_MISMATCH"),
  );
  await assert.rejects(
    () =>
      processMedia({
        body: new TextEncoder().encode("not an image"),
        contentType: "image/jpeg",
        profile: PHOTO_STANDARD,
      }),
    (error: unknown) => hasCode(error, "INVALID_IMAGE"),
  );
});

test("A0 enforces caller byte limits and the decoded 40MP ceiling", async () => {
  const small = await createRaster("png", 32, 32);
  await assert.rejects(
    () =>
      processMedia({
        body: small,
        contentType: "image/png",
        profile: PHOTO_STANDARD,
        maxInputBytes: small.byteLength - 1,
      }),
    (error: unknown) => hasCode(error, "INPUT_TOO_LARGE"),
  );

  const overLimit = await createRaster("png", 6401, 6250, "#101010");
  assert.ok(6401 * 6250 > 40_000_000);
  await assert.rejects(
    () => processMedia({ body: overLimit, contentType: "image/png", profile: PHOTO_STANDARD }),
    (error: unknown) => hasCode(error, "PIXEL_LIMIT_EXCEEDED"),
  );
});

test("PHOTO_STANDARD normalizes EXIF orientation and strips source metadata", async () => {
  const oriented = new Uint8Array(
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#cc8844" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer(),
  );
  const inputMetadata = await sharp(oriented).metadata();
  assert.equal(inputMetadata.orientation, 6);
  assert.ok(inputMetadata.exif);

  const result = await processMedia({
    body: oriented,
    contentType: "image/jpeg",
    profile: PHOTO_STANDARD,
  });
  const master = result.variants.find(({ variant }) => variant === "master");
  assert.ok(master);
  assert.equal(master.widthPx, 20);
  assert.equal(master.heightPx, 40);
  const metadata = await sharp(master.body).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.xmp, undefined);
});

test("PHOTO_STANDARD preserves ratio, applies max edges, and never enlarges source pixels", async () => {
  const large = await processMedia({
    body: await createRaster("jpeg", 4096, 2048),
    contentType: "image/jpeg",
    profile: PHOTO_STANDARD,
  });
  const dims = Object.fromEntries(
    large.variants.map(({ variant, widthPx, heightPx }) => [variant, [widthPx, heightPx]]),
  );
  assert.deepEqual(dims.master, [2048, 1024]);
  assert.deepEqual(dims.card, [800, 400]);
  assert.deepEqual(dims.thumb, [400, 200]);

  const small = await processMedia({
    body: await createRaster("png", 320, 160),
    contentType: "image/png",
    profile: PHOTO_STANDARD,
  });
  for (const variant of small.variants) {
    assert.equal(variant.widthPx, 320);
    assert.equal(variant.heightPx, 160);
  }
});

test("PAGE_BANNER_STANDARD uses fixed canvases and contains oversized artwork without crop", async () => {
  const left = await sharp({
    create: { width: 1500, height: 1000, channels: 3, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: { width: 1500, height: 1000, channels: 3, background: "#0000ff" },
  })
    .png()
    .toBuffer();
  const artwork = new Uint8Array(
    await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#000000" } })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: right, left: 1500, top: 0 },
      ])
      .png()
      .toBuffer(),
  );

  const result = await processMedia({
    body: artwork,
    contentType: "image/png",
    profile: PAGE_BANNER_STANDARD,
  });
  assert.deepEqual(
    result.variants.map(({ variant }) => variant),
    ["master", "display", "mobile"],
  );

  const expected = {
    master: { width: 2160, height: 1560, artworkHeight: 720 },
    display: { width: 1440, height: 1040, artworkHeight: 480 },
    mobile: { width: 720, height: 520, artworkHeight: 240 },
  } as const;

  for (const variant of result.variants) {
    const frame = expected[variant.variant as keyof typeof expected];
    const metadata = await sharp(variant.body).metadata();
    assert.deepEqual([metadata.width, metadata.height], [frame.width, frame.height]);
    assert.equal(metadata.format, "webp");

    const { data, info } = await sharp(variant.body)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0] as const;
    };
    const isBackground = ([r, g, b]: readonly number[]) =>
      Math.abs(r - 5) <= 10 && Math.abs(g - 6) <= 10 && Math.abs(b - 5) <= 10;
    const middleY = Math.floor(frame.height / 2);
    const artworkTop = (frame.height - frame.artworkHeight) / 2;

    const leftEdge = pixel(12, middleY);
    const rightEdge = pixel(frame.width - 13, middleY);
    assert.ok(leftEdge[0] > 150 && leftEdge[1] < 100 && leftEdge[2] < 100);
    assert.ok(rightEdge[2] > 150 && rightEdge[0] < 100 && rightEdge[1] < 100);
    assert.ok(isBackground(pixel(Math.floor(frame.width / 2), artworkTop - 12)));
    assert.ok(
      isBackground(pixel(Math.floor(frame.width / 2), artworkTop + frame.artworkHeight + 11)),
    );
    assert.ok(isBackground(pixel(0, 0)));
  }
});

test("PAGE_BANNER_STANDARD keeps fixed canvases while small artwork remains natural size", async () => {
  const sourceWidth = 180;
  const sourceHeight = 130;
  const result = await processMedia({
    body: await createRaster("png", sourceWidth, sourceHeight, "#00ff00"),
    contentType: "image/png",
    profile: PAGE_BANNER_STANDARD,
  });

  const expected = {
    master: [2160, 1560],
    display: [1440, 1040],
    mobile: [720, 520],
  } as const;

  for (const variant of result.variants) {
    const [canvasWidth, canvasHeight] = expected[variant.variant as keyof typeof expected];
    const metadata = await sharp(variant.body).metadata();
    assert.deepEqual([metadata.width, metadata.height], [canvasWidth, canvasHeight]);

    const { data, info } = await sharp(variant.body)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0] as const;
    };
    const isGreen = ([r, g, b]: readonly number[]) => g > 150 && r < 100 && b < 100;
    const isBackground = ([r, g, b]: readonly number[]) =>
      Math.abs(r - 5) <= 10 && Math.abs(g - 6) <= 10 && Math.abs(b - 5) <= 10;

    const left = (canvasWidth - sourceWidth) / 2;
    const top = (canvasHeight - sourceHeight) / 2;
    const right = left + sourceWidth - 1;
    const bottom = top + sourceHeight - 1;
    const centerX = Math.floor(canvasWidth / 2);
    const centerY = Math.floor(canvasHeight / 2);

    assert.ok(isGreen(pixel(left + 8, top + 8)));
    assert.ok(isGreen(pixel(right - 8, bottom - 8)));
    assert.ok(isGreen(pixel(centerX, centerY)));
    assert.ok(isBackground(pixel(left - 8, centerY)));
    assert.ok(isBackground(pixel(right + 8, centerY)));
    assert.ok(isBackground(pixel(centerX, top - 8)));
    assert.ok(isBackground(pixel(centerX, bottom + 8)));
    assert.ok(isBackground(pixel(0, 0)));
  }
});

test("writeMediaVariants returns descriptors and exact cleanup keys for later domain ownership", async () => {
  const processed = await processMedia({
    body: await createRaster("jpeg", 900, 450),
    contentType: "image/jpeg",
    profile: PHOTO_STANDARD,
  });
  const puts: string[] = [];
    const storage = {
      async put(key: string, body: Uint8Array, contentType: string) {
      puts.push(key);
      return { key, contentType, sizeBytes: body.byteLength };
    },
    async get() {
      throw new Error("not used");
    },
    async remove() {},
  };
  const result = await writeMediaVariants({
    storage,
    identity: {
      scope: "staging",
      namespace: "PLACE_PHOTO",
      ownerId: "place-1",
      mediaId: "media-1",
    },
    processed,
  });

  assert.deepEqual(
    puts,
    result.descriptors.map(({ objectKey }) => objectKey),
  );
  assert.deepEqual(result.cleanupKeys, puts);
  assert.equal(result.descriptors.length, 3);
  for (const descriptor of result.descriptors) {
    assert.equal(descriptor.namespace, "PLACE_PHOTO");
    assert.equal(descriptor.ownerId, "place-1");
    assert.equal(descriptor.mediaId, "media-1");
    assert.equal(descriptor.contentType, "image/webp");
    assert.ok(descriptor.sizeBytes > 0);
    assert.ok(descriptor.widthPx > 0 && descriptor.heightPx > 0);
  }
});

test("writeMediaVariants exposes deterministic recovery info after partial variant failure", async () => {
  const processed = await processMedia({
    body: await createRaster("jpeg", 900, 450),
    contentType: "image/jpeg",
    profile: PHOTO_STANDARD,
  });
  const writes: string[] = [];
  const storage = {
    async put(key: string, body: Uint8Array, contentType: string) {
      if (key.endsWith("/thumb.webp")) throw new Error("simulated thumb failure");
      writes.push(key);
      return { key, contentType, sizeBytes: body.byteLength };
    },
      async get() {
        throw new Error("not used");
      },
      async remove() {},
    };

    await assert.rejects(
    () =>
      writeMediaVariants({
        storage,
        identity: {
          scope: "production",
          namespace: "PLACE_PHOTO",
          ownerId: "place-1",
          mediaId: "media-1",
        },
        processed,
      }),
    (error: unknown) => {
      assert.ok(error instanceof MediaVariantWriteError);
      assert.equal(error.failedVariant, "thumb");
      assert.deepEqual(error.cleanupKeys, writes);
      assert.deepEqual(
        error.writtenDescriptors.map(({ objectKey }) => objectKey),
        writes,
      );
      assert.deepEqual(error.plannedKeys, [
        "production/media/v1/place-photo/place-1/media-1/master.webp",
        "production/media/v1/place-photo/place-1/media-1/card.webp",
        "production/media/v1/place-photo/place-1/media-1/thumb.webp",
      ]);
      return true;
    },
  );
});

test(
  "writeMediaVariants fails closed on returned-key mismatch with canonical recovery authority",
  async () => {
    const processed = await processMedia({
      body: await createRaster("jpeg", 900, 450),
      contentType: "image/jpeg",
      profile: PHOTO_STANDARD,
    });
    const attemptedKeys: string[] = [];
    const mismatchedReturnedKey = "provider/remapped/place-photo/place-1/media-1/card.webp";

    const storage = {
      async put(key: string, body: Uint8Array, contentType: string) {
        attemptedKeys.push(key);
        if (key.endsWith("/card.webp")) {
          return {
            key: mismatchedReturnedKey,
            contentType,
            sizeBytes: body.byteLength,
          };
        }
        return { key, contentType, sizeBytes: body.byteLength };
      },
      async get() {
        throw new Error("not used");
      },
      async remove() {},
    };

    await assert.rejects(
      () =>
        writeMediaVariants({
          storage,
          identity: {
            scope: "production",
            namespace: "PLACE_PHOTO",
            ownerId: "place-1",
            mediaId: "media-1",
          },
          processed,
        }),
      (error: unknown) => {
        assert.ok(error instanceof MediaVariantWriteError);
        assert.equal(error.failedVariant, "card");
        assert.deepEqual(
          error.writtenDescriptors.map(({ objectKey }) => objectKey),
          ["production/media/v1/place-photo/place-1/media-1/master.webp"],
        );
        assert.deepEqual(error.cleanupKeys, [
          "production/media/v1/place-photo/place-1/media-1/master.webp",
          "production/media/v1/place-photo/place-1/media-1/card.webp",
        ]);
        assert.ok(!error.cleanupKeys.includes(mismatchedReturnedKey));
        assert.deepEqual(error.plannedKeys, [
          "production/media/v1/place-photo/place-1/media-1/master.webp",
          "production/media/v1/place-photo/place-1/media-1/card.webp",
          "production/media/v1/place-photo/place-1/media-1/thumb.webp",
        ]);
        return true;
      },
    );

    assert.deepEqual(attemptedKeys, [
      "production/media/v1/place-photo/place-1/media-1/master.webp",
      "production/media/v1/place-photo/place-1/media-1/card.webp",
    ]);
  },
);
