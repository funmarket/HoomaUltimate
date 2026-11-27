import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");

test("Athletes community detail prefers managed logo and preserves banner presentation", () => {
  assert.match(
    pages,
    /src=\{detail\.bannerUrl\}[\s\S]*detail\.bannerMediaPath[\s\S]*identityMediaUrl\(id, "banner"\)/,
  );
  assert.match(
    pages,
    /src=\{detail\.logoMediaPath \? api\.athletes\.identityMediaUrl\(id, "logo"\) : detail\.logoUrl\}/,
  );
  assert.match(pages, /const sources = \[src, fallbackSrc\]/);
  assert.match(pages, /const activeSrc = sources\.find/);
});
