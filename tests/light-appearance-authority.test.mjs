import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themeCss = new URL("../apps/web/src/theme.css", import.meta.url);
const legacyCss = new URL("../apps/web/src/styles.css", import.meta.url);
const accountCss = new URL("../apps/web/src/account/account.css", import.meta.url);
const profileCss = new URL("../apps/web/src/profile/profile.css", import.meta.url);

test("Light appearance exposes one semantic application palette", async () => {
  const css = await readFile(themeCss, "utf8");

  assert.match(css, /--app-text-strong:\s*#10110f/);
  assert.match(css, /--app-text:\s*#24251f/);
  assert.match(css, /--app-text-secondary:\s*#5f6259/);
  assert.match(css, /--app-text-caption:\s*#70736a/);
  assert.match(css, /--app-line-strong:\s*rgba\(24, 25, 21, 0\.34\)/);
});

test("legacy global CSS no longer owns the application color scheme", async () => {
  const css = await readFile(legacyCss, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.doesNotMatch(root, /color\s*:/);
  assert.doesNotMatch(root, /background\s*:/);
  assert.match(root, /--shell-inline:\s*clamp\(12px, 6vw, 24px\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*border:\s*1px solid var\(--app-line-strong\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*background:\s*var\(--app-surface\)/);
  assert.doesNotMatch(css, /padding:\s*48px 24px/);
  assert.match(css, /padding:\s*0 var\(--shell-inline\) 48px/);
});

test("account styles map to app semantics instead of declaring another light palette", async () => {
  const css = await readFile(accountCss, "utf8");

  assert.match(css, /--hooma-text:\s*var\(--app-text\)/);
  assert.match(css, /--hooma-muted:\s*var\(--app-text-secondary\)/);
  assert.match(css, /--hooma-border:\s*var\(--app-line-strong\)/);
  assert.doesNotMatch(css, /:root\[data-theme="light"\]\s*\{[\s\S]*--hooma-bg/);
  assert.doesNotMatch(css, /:root\[data-theme="light"\]\s+\.panel/);
});

test("top account chrome stays dark and owns safe-area spacing", async () => {
  const css = await readFile(accountCss, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(root, /--hooma-chrome-bg:\s*#070808/);
  assert.match(css, /\.hooma-topbar\s*\{[\s\S]*background:\s*var\(--hooma-chrome-bg\)/);
  assert.match(
    css,
    /padding:\s*max\(8px, env\(safe-area-inset-top, 0px\)\) var\(--shell-inline\) 10px/,
  );
  assert.match(
    css,
    /\.hooma-profile-trigger\s*\{[\s\S]*background:\s*var\(--hooma-chrome-surface\)/,
  );
  assert.match(css, /\.hooma-account-menu\s*\{[\s\S]*color:\s*var\(--hooma-chrome-text\)/);
});

test("light profile sections preserve the current dark HOOMA Passport architecture", async () => {
  const css = await readFile(profileCss, "utf8");

  assert.doesNotMatch(css, /\.public-profile-hero/);
  assert.match(css, /\.hooma-passport-card\s*\{[\s\S]*background:\s*#070808/);
  assert.match(css, /\.hooma-passport-card h1\s*\{[\s\S]*color:\s*#fff/);
  assert.match(css, /\.hooma-passport-card__handle\s*\{[\s\S]*color:\s*#5ce1ff/);
  assert.match(css, /\.hooma-passport-card__ovr\s*\{[\s\S]*color:\s*#ffd200/);
  assert.match(css, /\.hooma-passport-stats\s*\{[\s\S]*background:\s*#0b0b0b/);
  assert.match(css, /\.public-profile-contact button\s*\{[\s\S]*color:\s*#b8ff2a/);
});
