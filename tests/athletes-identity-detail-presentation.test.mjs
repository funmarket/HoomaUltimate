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
    /src=\{\s*detail\.logoMediaPath \? api\.athletes\.identityMediaUrl\(id, "logo"\) : detail\.logoUrl\s*\}/,
  );
  assert.match(pages, /const sources = \[src, fallbackSrc\]/);
  assert.match(pages, /const activeSrc = sources\.find/);
});

test("Athletes discovery and detail banners share a full-width centered cover frame", () => {
  const css = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
  const frame = css.match(/\.athletes-banner-frame\s*\{([^}]+)\}/)?.[1] ?? "";
  const image = css.match(/\.athletes-banner\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(frame, /width: 100%;/);
  assert.match(frame, /height: 16rem;/);
  assert.match(frame, /overflow: hidden;/);
  assert.match(image, /width: 100%;/);
  assert.match(image, /height: 100%;/);
  assert.match(image, /object-fit: cover;/);
  assert.match(image, /object-position: center;/);
  assert.doesNotMatch(image, /max-width|max-height|object-fit: contain/);
  assert.equal([...pages.matchAll(/className="athletes-banner"/g)].length, 2);
  assert.match(pages, /className === "athletes-banner"/);
  assert.match(pages, /<span className="athletes-banner-frame">\{image\}<\/span>/);
  assert.match(pages, /if \(!activeSrc\) return null;/);
});
