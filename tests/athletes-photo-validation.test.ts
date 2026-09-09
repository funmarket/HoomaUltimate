import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SharpAthletesPhotoValidator } from "../apps/api/src/modules/athletes/infrastructure/sharp-athletes-photo-validator.js";
const validator = new SharpAthletesPhotoValidator();
test("Athletes decodes valid photos and rejects corrupt and spoofed input", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const body = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#aabbcc" },
    })
      .toFormat(format)
      .toBuffer();
    await validator.validate(body, `image/${format}`);
    await assert.rejects(() => validator.validate(body.subarray(0, 12), `image/${format}`));
    await assert.rejects(() =>
      validator.validate(body, format === "png" ? "image/jpeg" : "image/png"),
    );
  }
  await assert.rejects(() =>
    validator.validate(new TextEncoder().encode("not an image"), "image/jpeg"),
  );
});
