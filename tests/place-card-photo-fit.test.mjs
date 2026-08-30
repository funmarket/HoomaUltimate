import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const placesCssUrl = new URL("../packages/frontend/src/places/places.css", import.meta.url);
const galleryCssUrl = new URL("../packages/frontend/src/places/place-gallery.css", import.meta.url);

function ruleBody(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule must exist`);
  const bodyStart = css.indexOf("{", start) + 1;
  const end = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, end);
}

test("Spot directory photos adapt to their intrinsic aspect ratio", async () => {
  const css = await readFile(placesCssUrl, "utf8");
  const mediaRule = ruleBody(css, ".place-card.place-card--directory .place-card__media");
  const imageRule = ruleBody(css, ".place-card.place-card--directory .place-card__media img");

  assert.doesNotMatch(mediaRule, /aspect-ratio:/);
  assert.match(mediaRule, /max-height:\s*min\(70vh, 640px\);/);
  assert.match(imageRule, /height:\s*auto;/);
  assert.match(imageRule, /max-height:\s*min\(70vh, 640px\);/);
  assert.doesNotMatch(css, /\.place-card__media\s*\{[^}]*aspect-ratio:/);
});

test("Place gallery adapts to photo aspect ratios without cropping", async () => {
  const css = await readFile(galleryCssUrl, "utf8");
  const frameRule = ruleBody(css, ".place-gallery__frame");
  const imageRule = ruleBody(css, ".place-gallery__frame img");

  assert.doesNotMatch(frameRule, /aspect-ratio:/);
  assert.match(frameRule, /max-height:\s*min\(85vh, 960px\);/);
  assert.match(imageRule, /width:\s*100%;/);
  assert.match(imageRule, /height:\s*auto;/);
  assert.match(imageRule, /max-height:\s*min\(85vh, 960px\);/);
  assert.match(imageRule, /object-fit:\s*contain;/);
  assert.match(imageRule, /object-position:\s*center;/);
  assert.doesNotMatch(imageRule, /object-fit:\s*cover;/);
});
