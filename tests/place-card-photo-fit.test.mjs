import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const placesCssUrl = new URL("../packages/frontend/src/places/places.css", import.meta.url);
const galleryCssUrl = new URL(
  "../packages/frontend/src/places/place-gallery.css",
  import.meta.url,
);

test("Spot directory photos adapt to their intrinsic aspect ratio", async () => {
  const css = await readFile(placesCssUrl, "utf8");
  const mediaRule =
    css.match(/\.place-card\.place-card--directory \.place-card__media \{([\s\S]*?)\}/)?.[1] ??
    "";
  const imageRule =
    css.match(
      /\.place-card\.place-card--directory \.place-card__media img \{([\s\S]*?)\}/,
    )?.[1] ?? "";

  assert.ok(mediaRule, "Spot directory media rule must exist");
  assert.doesNotMatch(mediaRule, /aspect-ratio:/);
  assert.match(mediaRule, /max-height:\s*min\(70vh, 640px\);/);

  assert.ok(imageRule, "Spot directory image rule must exist");
  assert.match(imageRule, /height:\s*auto;/);
  assert.match(imageRule, /max-height:\s*min\(70vh, 640px\);/);

  const mobileRule = css.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const mobileMediaRule = mobileRule.match(/\.place-card__media \{([\s\S]*?)\}/)?.[1] ?? "";
  assert.ok(mobileMediaRule, "Mobile Place media rule must exist");
  assert.doesNotMatch(mobileMediaRule, /aspect-ratio:/);
});

test("Place gallery follows portrait, square, and landscape photo ratios without cropping", async () => {
  const css = await readFile(galleryCssUrl, "utf8");
  const frameRule = css.match(/\.place-gallery__frame \{([\s\S]*?)\}/)?.[1] ?? "";
  const imageRule = css.match(/\.place-gallery__frame img \{([\s\S]*?)\}/)?.[1] ?? "";

  assert.ok(frameRule, "Place gallery frame rule must exist");
  assert.doesNotMatch(frameRule, /aspect-ratio:/);
  assert.match(frameRule, /max-height:\s*min\(85vh, 960px\);/);

  assert.ok(imageRule, "Place gallery image rule must exist");
  assert.match(imageRule, /width:\s*100%;/);
  assert.match(imageRule, /height:\s*auto;/);
  assert.match(imageRule, /max-height:\s*min\(85vh, 960px\);/);
  assert.match(imageRule, /object-fit:\s*contain;/);
  assert.match(imageRule, /object-position:\s*center;/);
  assert.doesNotMatch(imageRule, /object-fit:\s*cover;/);
});
