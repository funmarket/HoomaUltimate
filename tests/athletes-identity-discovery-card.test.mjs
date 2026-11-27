import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const api = readFileSync("packages/frontend/src/athletes/api.ts", "utf8");

test("Athletes discovery cards prefer the managed logo and use an external URL only without managed media", () => {
  assert.match(
    pages,
    /src=\{\s*item\.logoMediaPath\s*\?\s*api\.athletes\.identityMediaUrl\(item\.id, "logo"\)\s*:\s*item\.logoUrl\s*\}/,
  );
  assert.match(
    pages,
    /src=\{item\.bannerUrl\}[\s\S]*fallbackSrc=\{[\s\S]*item\.bannerMediaPath[\s\S]*identityMediaUrl\(item\.id, "banner"\)/,
  );
  assert.match(pages, /const sources = \[src, fallbackSrc\]/);
  assert.match(pages, /const activeSrc = sources\.find/);
  assert.match(pages, /setFailedSources\(\(previous\) => \[\.\.\.previous, activeSrc\]\)/);
  assert.match(api, /identityMediaUrl: \(id: string, slot: "logo" \| "banner"\)/);
});
