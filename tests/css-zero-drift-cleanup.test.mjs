import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = new URL("../apps/web/src/main.tsx", import.meta.url);
const legacyStyles = new URL("../apps/web/src/styles.css", import.meta.url);
const themeStyles = new URL("../apps/web/src/theme.css", import.meta.url);

test("canonical theme layer remains after legacy web styles", async () => {
  const source = await readFile(mainSource, "utf8");
  assert.ok(source.indexOf('import "./theme.css"') > source.indexOf('import "./styles.css"'));
});

test("legacy web stylesheet does not redefine canonical title or caption sizes", async () => {
  const [legacy, theme] = await Promise.all([
    readFile(legacyStyles, "utf8"),
    readFile(themeStyles, "utf8"),
  ]);

  assert.doesNotMatch(legacy, /h1\s*\{[^}]*font-size:/s);
  assert.doesNotMatch(legacy, /\.eyebrow\s*\{[^}]*font-size:/s);
  assert.match(theme, /h1,[\s\S]*\.type-title\s*\{\s*font-size:\s*var\(--type-title\)/);
  assert.match(theme, /\.eyebrow,[\s\S]*\.type-caption\s*\{\s*font-size:\s*var\(--type-caption\)/);
});

test("legacy eyebrow presentation is consolidated without changing its final non-size values", async () => {
  const legacy = await readFile(legacyStyles, "utf8");
  const blocks = [...legacy.matchAll(/\.eyebrow\s*\{([^}]*)\}/gs)];

  assert.equal(blocks.length, 1);
  assert.match(blocks[0][1], /color:\s*#c4dc43/);
  assert.match(blocks[0][1], /text-transform:\s*uppercase/);
  assert.match(blocks[0][1], /letter-spacing:\s*0\.14em/);
});
