import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpAthletesPhotoOptimizer } from "../apps/api/src/modules/athletes/infrastructure/sharp-athletes-photo-optimizer.js";

const optimizer = new SharpAthletesPhotoOptimizer();

test("Athletes Photo Board normalizes large uploads to bounded WebP", async () => {
  const input = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#607080" },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const result = await optimizer.optimize(input, "image/jpeg");
  const metadata = await sharp(result.body).metadata();

  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
});

test("Athletes Photo Board never enlarges smaller photos", async () => {
  const input = await sharp({
    create: { width: 500, height: 300, channels: 3, background: "#405060" },
  })
    .png()
    .toBuffer();

  const result = await optimizer.optimize(input, "image/png");
  const metadata = await sharp(result.body).metadata();

  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.width, 500);
  assert.equal(metadata.height, 300);
});
