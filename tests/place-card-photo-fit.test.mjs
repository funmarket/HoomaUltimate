import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Spot card photos stay fully visible and centered", async () => {
  const css = await readFile(
    new URL("../packages/frontend/src/places/places.css", import.meta.url),
    "utf8",
  );
  const rule = css.match(/\.place-card__media img \{([\s\S]*?)\}/)?.[1] ?? "";

  assert.ok(rule, "Place card image rule must exist");
  assert.match(rule, /object-fit:\s*contain;/);
  assert.match(rule, /object-position:\s*center;/);
  assert.doesNotMatch(rule, /object-fit:\s*cover;/);
});
