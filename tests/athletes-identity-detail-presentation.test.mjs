import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");

test("Athletes community detail presents managed logo and banner with external URL fallback", () => {
  assert.match(
    pages,
    /src=\{detail\.bannerUrl\}[\s\S]*detail\.bannerMediaPath[\s\S]*identityMediaUrl\(id, "banner"\)/,
  );
  assert.match(
    pages,
    /src=\{detail\.logoUrl\}[\s\S]*detail\.logoMediaPath[\s\S]*identityMediaUrl\(id, "logo"\)/,
  );
  assert.match(pages, /const sources = \[src, fallbackSrc\]/);
  assert.match(pages, /const activeSrc = sources\.find/);
});
