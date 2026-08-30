import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const culturalCardUrl = new URL(
  "../packages/frontend/src/watch/CulturalEventCard.tsx",
  import.meta.url,
);
const culturalCssUrl = new URL("../packages/frontend/src/watch/cultural.css", import.meta.url);
const placesCssUrl = new URL("../packages/frontend/src/places/places.css", import.meta.url);

test("Cultural card owns its image and does not fall back to Spot media", async () => {
  const source = await readFile(culturalCardUrl, "utf8");

  assert.match(source, /details\.imageUrl\s*\?/);
  assert.doesNotMatch(source, /details\.imageUrl\s*\?\?\s*place\.imageUrl/);
  assert.doesNotMatch(source, /src=\{place\.imageUrl\}/);
});

test("Cultural and Spot image containers independently preserve full images", async () => {
  const [culturalCss, placesCss] = await Promise.all([
    readFile(culturalCssUrl, "utf8"),
    readFile(placesCssUrl, "utf8"),
  ]);

  const culturalRule =
    culturalCss.match(/\.watch-cultural-card__media img \{([\s\S]*?)\}/)?.[1] ?? "";
  const spotRule = placesCss.match(/\.place-card__media img \{([\s\S]*?)\}/)?.[1] ?? "";

  assert.ok(culturalRule, "Cultural card image rule must exist");
  assert.match(culturalRule, /object-fit:\s*contain;/);
  assert.match(culturalRule, /object-position:\s*center;/);
  assert.doesNotMatch(culturalRule, /object-fit:\s*cover;/);

  assert.ok(spotRule, "Spot card image rule must exist");
  assert.match(spotRule, /object-fit:\s*contain;/);
  assert.match(spotRule, /object-position:\s*center;/);
  assert.doesNotMatch(spotRule, /object-fit:\s*cover;/);
});
