import assert from "node:assert/strict";
import test from "node:test";

const { contrastAfterOpacity, hasOverlappingMedia } =
  await import("../scripts/light-appearance-contrast.mjs").catch(() => ({}));

test("disabled text is measured after its translucent control is composited over the page", () => {
  assert.equal(
    typeof contrastAfterOpacity,
    "function",
    "contrastAfterOpacity must be implemented",
  );
  const result = contrastAfterOpacity({
    foreground: [255, 255, 255, 1],
    surface: [47, 111, 62, 1],
    backdrop: [255, 255, 255, 1],
    foregroundOpacity: 1,
    groupOpacity: 0.45,
  });
  assert.ok(
    result.ratio < 4.5,
    `expected disabled button text to fail 4.5:1, got ${result.ratio}`,
  );
  assert.ok(
    result.ratio > 1,
    `expected a measured contrast ratio, got ${result.ratio}`,
  );
});

test("opaque white text on the approved green action remains above 4.5:1", () => {
  const result = contrastAfterOpacity({
    foreground: [255, 255, 255, 1],
    surface: [47, 111, 62, 1],
    backdrop: [255, 255, 255, 1],
    foregroundOpacity: 1,
    groupOpacity: 1,
  });
  assert.ok(
    result.ratio >= 4.5,
    `expected readable action text, got ${result.ratio}`,
  );
});

test("text alpha and surface alpha are both included in the displayed pair", () => {
  assert.equal(
    typeof contrastAfterOpacity,
    "function",
    "contrastAfterOpacity must be implemented",
  );
  const result = contrastAfterOpacity({
    foreground: [38, 38, 38, 0.5],
    surface: [255, 255, 255, 0.5],
    backdrop: [240, 242, 245, 1],
    foregroundOpacity: 1,
    groupOpacity: 1,
  });
  assert.ok(
    result.ratio < 4.5,
    `expected alpha-composited text to fail 4.5:1, got ${result.ratio}`,
  );
});

test("visible text overlapping a rendered media element is marked for raster evidence", () => {
  assert.equal(
    typeof hasOverlappingMedia,
    "function",
    "hasOverlappingMedia must be implemented",
  );
  assert.equal(hasOverlappingMedia([10, 10, 30, 30], [[20, 20, 40, 40]]), true);
  assert.equal(
    hasOverlappingMedia([10, 10, 20, 20], [[20, 20, 40, 40]]),
    false,
  );
});
