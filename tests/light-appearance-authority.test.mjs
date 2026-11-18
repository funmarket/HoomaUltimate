import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themeCss = new URL("../apps/web/src/theme.css", import.meta.url);
const legacyCss = new URL("../apps/web/src/styles.css", import.meta.url);
const accountCss = new URL("../apps/web/src/account/account.css", import.meta.url);
const profileCss = new URL("../apps/web/src/profile/profile.css", import.meta.url);
const playCss = new URL("../packages/frontend/src/events/play.css", import.meta.url);
const playPlayerCss = new URL(
  "../packages/frontend/src/events/play-player-listing.css",
  import.meta.url,
);
const hoomaSemanticCss = new URL(
  "../packages/frontend/src/communities/hooma-page-semantic.css",
  import.meta.url,
);

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
  assert.doesNotMatch(css, /--shell-inline|foundation-shell--inline-/);
  assert.match(css, /\.panel\s*\{[\s\S]*border:\s*1px solid var\(--app-line-strong\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*background:\s*var\(--app-surface\)/);
  assert.doesNotMatch(css, /padding:\s*48px 24px/);
  const baseShell = css.match(/(?:^|\})\s*\.foundation-shell\s*\{([^{}]*)\}/)?.[1] ?? "";
  assert.match(baseShell, /padding:\s*0 0 48px/);
  assert.doesNotMatch(baseShell, /--shell-inline/);
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
  const topbar = css.match(/\.hooma-topbar\s*\{([^{}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(topbar, /--shell-inline|margin-inline/);
  assert.match(topbar, /padding-top:\s*max\(8px, env\(safe-area-inset-top, 0px\)\)/);
  assert.match(topbar, /padding-bottom:\s*10px/);
  assert.match(topbar, /--hooma-ui-page-inline/);
  assert.doesNotMatch(topbar, /--hooma-ui-lane-/);
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


test("light appearance keeps intentional Play and HOOMA dark surfaces readable", async () => {
  const [play, players, hooma] = await Promise.all([
    readFile(playCss, "utf8"),
    readFile(playPlayerCss, "utf8"),
    readFile(hoomaSemanticCss, "utf8"),
  ]);

  assert.match(
    play,
    /:root\[data-theme="light"\] \.play-page \.play-view-tabs\s*\{[\s\S]*--app-text-secondary:\s*#c8c3b8;[\s\S]*--app-positive:\s*#a3e635;/,
  );
  assert.match(
    players,
    /:root\[data-theme="light"\] \.play-page[\s\S]*\.play-looking-options button[\s\S]*--app-text:\s*#f4f1ea;[\s\S]*--app-positive:\s*#a3e635;/,
  );
  assert.match(
    hooma,
    /:root\[data-theme="light"\] \.hooma-page[\s\S]*\.hooma-discovery-card[\s\S]*--hooma-page-text-strong:\s*#f4f1ea;[\s\S]*--hooma-page-people:\s*#58bfff;/,
  );
});
