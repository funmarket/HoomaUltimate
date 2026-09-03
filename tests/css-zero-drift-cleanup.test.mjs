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

test("legacy web stylesheet does not redefine canonical title or caption sizes with hardcoded values", async () => {
  const [legacy, theme] = await Promise.all([
    readFile(legacyStyles, "utf8"),
    readFile(themeStyles, "utf8"),
  ]);

  // Legacy may reference the canonical variable but must not hardcode font-size values
  // Check h1 block for hardcoded font-size (not using var(--type-title))
  const h1Block = legacy.match(/h1\s*\{[^}]*\}/s)?.[0] || "";
  const h1UsesVar = /font-size:\s*var\(--type-title\)/.test(h1Block);

  // Check .eyebrow block for hardcoded font-size (not using var(--type-caption))
  // Note: .eyebrow may not have font-size at all (inherits from theme) - that's fine
  const eyebrowBlock = legacy.match(/\.eyebrow\s*\{[^}]*\}/s)?.[0] || "";
  const eyebrowHasFontSize = /font-size:/.test(eyebrowBlock);
  const eyebrowUsesVar = eyebrowHasFontSize ? /font-size:\s*var\(--type-caption\)/.test(eyebrowBlock) : true;

  assert.equal(h1UsesVar, true, "legacy h1 must use var(--type-title) for font-size");
  assert.equal(eyebrowUsesVar, true, "legacy .eyebrow must use var(--type-caption) for font-size if it declares one");

  assert.match(theme, /h1,[^}]*\.type-title\s*\{\s*font-size:\s*var\(--type-title\)/);
  assert.match(theme, /\.eyebrow,[^}]*\.type-caption\s*\{\s*font-size:\s*var\(--type-caption\)/);
});

test("legacy eyebrow presentation is consolidated without changing its final non-size values", async () => {
  const legacy = await readFile(legacyStyles, "utf8");
  const blocks = [...legacy.matchAll(/\.eyebrow\s*\{([^}]*)\}/gs)];

  assert.equal(blocks.length, 1);
  assert.match(blocks[0][1], /color:\s*var\(--app-gold\)/);
  assert.match(blocks[0][1], /text-transform:\s*uppercase/);
  assert.match(blocks[0][1], /letter-spacing:\s*0\.14em/);
});

test("explicit dark inherits the identical root app palette instead of redeclaring it", async () => {
  const theme = await readFile(themeStyles, "utf8");

  assert.match(theme, /:root\s*\{[\s\S]*--app-bg:\s*#070808/);
  assert.match(theme, /:root\s*\{[\s\S]*--app-bg-raised:\s*#121212/);
  assert.match(theme, /:root\s*\{[\s\S]*--app-text:\s*#f4f1ea/);
  assert.match(theme, /:root\s*\{[\s\S]*--app-gold:\s*#e8c36a/);
  assert.match(theme, /:root\s*\{[\s\S]*--app-positive:\s*#a3e635/);
  assert.match(theme, /:root\s*\{[\s\S]*--app-lime:\s*var\(--app-positive\)/);
  assert.doesNotMatch(theme, /:root\[data-appearance="dark"\]\s*\{/);
});

test("zero-drift cleanup keeps light and System-dark overrides intact", async () => {
  const theme = await readFile(themeStyles, "utf8");

  assert.match(theme, /:root\[data-theme="light"\]\s*\{[\s\S]*--app-bg:\s*#f6f4ee/);
  assert.match(
    theme,
    /:root\[data-appearance="system"\]\[data-theme="dark"\]\s*\{[\s\S]*--app-bg:\s*#000000/,
  );
  assert.match(
    theme,
    /:root\[data-appearance="system"\]\[data-theme="dark"\] body\s*\{\s*background:\s*#000000/,
  );
});
