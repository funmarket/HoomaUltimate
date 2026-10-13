import assert from "node:assert/strict";
import test from "node:test";
import { placeImageOrderSchema, PLACE_APP_ADMIN_IMAGE_LIMIT, PLACE_OWNER_IMAGE_LIMIT } from "../packages/contracts/src/places.js";

test("Place reorder contract accepts three, six and historical over-limit full galleries", () => {
  for (const count of [PLACE_OWNER_IMAGE_LIMIT, PLACE_APP_ADMIN_IMAGE_LIMIT, 7, 9]) {
    const ids = Array.from({ length: count }, (_, index) => `image-${index}`);
    assert.deepEqual(placeImageOrderSchema.parse({ imageIds: ids }).imageIds, ids);
  }
});

test("Place reorder contract retains strict shape and nonempty IDs", () => {
  for (const invalid of [
    { imageIds: [] },
    { imageIds: [""] },
    { imageIds: ["  "] },
    { imageIds: ["image-1"], unrelated: true },
  ]) {
    assert.equal(placeImageOrderSchema.safeParse(invalid).success, false);
  }
});
