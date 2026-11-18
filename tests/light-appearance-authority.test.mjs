import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainSource = new URL("../apps/web/src/main.tsx", import.meta.url);
const themeCss = new URL("../apps/web/src/theme.css", import.meta.url);
const legacyCss = new URL("../apps/web/src/styles.css", import.meta.url);
const accountCss = new URL("../apps/web/src/account/account.css", import.meta.url);
const profileCss = new URL("../apps/web/src/profile/profile.css", import.meta.url);
const lightCss = new URL("../apps/web/src/light-mode.css", import.meta.url);
const communityMediaSource = new URL(
  "../packages/frontend/src/communities/CommunityMedia.tsx",
  import.meta.url,
);

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = new URL(
      entry.name,
      directory.href.endsWith("/") ? directory : `${directory.href}/`,
    );
    if (entry.isDirectory()) files.push(...(await cssFiles(target)));
    else if (entry.name.endsWith(".css") && entry.name !== "light-mode.css") files.push(target);
  }
  return files;
}

test("Light appearance exposes the complete neutral HOOMA palette", async () => {
  const css = await readFile(themeCss, "utf8");
  const light = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(light, /--app-bg:\s*#f0f2f5/);
  assert.match(light, /--app-surface:\s*#ffffff/);
  assert.match(light, /--app-subtle:\s*#efefef/);
  assert.match(light, /--app-text-strong:\s*#050505/);
  assert.match(light, /--app-text:\s*#262626/);
  assert.match(light, /--app-text-secondary:\s*#65676b/);
  assert.match(light, /--app-accent:\s*#2f6f3e/);
  assert.match(light, /--app-gold:\s*#8a6500/);
  assert.match(light, /--app-positive:\s*#2f6f3e/);
  assert.match(light, /--hooma-ui-bg:\s*#f0f2f5/);
  assert.match(light, /--hooma-ui-surface:\s*#ffffff/);
  assert.match(light, /--hooma-ui-text:\s*#050505/);
  assert.match(light, /--hooma-ui-accent:\s*#2f6f3e/);
});

test("Light palette text and primary actions preserve readable contrast", () => {
  assert.ok(contrastRatio("#262626", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#65676b", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#ffffff", "#2f6f3e") >= 4.5);
  assert.ok(contrastRatio("#8a6500", "#ffffff") >= 4.5);
});

test("Dark appearance remains owned by the unchanged root palette", async () => {
  const css = await readFile(themeCss, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(root, /--app-bg:\s*#070808/);
  assert.match(root, /--app-bg-raised:\s*#121212/);
  assert.match(root, /--app-surface:\s*#121212/);
  assert.match(root, /--app-text:\s*#f4f1ea/);
  assert.match(root, /--app-gold:\s*#e8c36a/);
  assert.match(root, /--app-positive:\s*#a3e635/);
  assert.doesNotMatch(css, /:root\[data-appearance="dark"\]\s*\{/);
});

test("the complete Light Mode layer loads after every feature stylesheet", async () => {
  const source = await readFile(mainSource, "utf8");
  const lightIndex = source.indexOf('import "./light-mode.css"');

  assert.ok(lightIndex > source.indexOf('import "./theme.css"'));
  assert.ok(lightIndex > source.indexOf('import "./account/account.css"'));
  assert.ok(lightIndex > source.indexOf('import "./profile/profile.css"'));
  assert.ok(lightIndex > source.indexOf('import "./telegram/runtime.css"'));
});

test("legacy global CSS does not own the application color scheme", async () => {
  const css = await readFile(legacyCss, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.doesNotMatch(root, /\bcolor\s*:/);
  assert.doesNotMatch(root, /\bbackground\s*:/);
  assert.doesNotMatch(css, /--shell-inline|foundation-shell--inline-/);
  assert.match(css, /\.panel\s*\{[\s\S]*border:\s*1px solid var\(--app-line-strong\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*background:\s*var\(--app-surface\)/);
  assert.doesNotMatch(css, /padding:\s*48px 24px/);
  const baseShell = css.match(/(?:^|\})\s*\.foundation-shell\s*\{([^{}]*)\}/)?.[1] ?? "";
  assert.match(baseShell, /padding:\s*0 0 48px/);
  assert.doesNotMatch(baseShell, /--shell-inline/);
});

test("account styles still map to app semantics instead of declaring another palette", async () => {
  const css = await readFile(accountCss, "utf8");

  assert.match(css, /--hooma-text:\s*var\(--app-text\)/);
  assert.match(css, /--hooma-muted:\s*var\(--app-text-secondary\)/);
  assert.match(css, /--hooma-border:\s*var\(--app-line-strong\)/);
  assert.doesNotMatch(css, /:root\[data-theme="light"\]\s*\{[\s\S]*--hooma-bg/);
  assert.doesNotMatch(css, /:root\[data-theme="light"\]\s+\.panel/);
});

test("account chrome keeps its safe-area geometry while Light Mode changes only color", async () => {
  const css = await readFile(accountCss, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const topbar = css.match(/\.hooma-topbar\s*\{([^{}]*)\}/)?.[1] ?? "";

  assert.match(root, /--hooma-chrome-bg:\s*#070808/);
  assert.match(css, /\.hooma-topbar\s*\{[\s\S]*background:\s*var\(--hooma-chrome-bg\)/);
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

test("Light Mode converts shell chrome and every major domain owner to light surfaces", async () => {
  const [account, light] = await Promise.all([
    readFile(accountCss, "utf8"),
    readFile(lightCss, "utf8"),
  ]);

  assert.match(account, /--hooma-chrome-bg:\s*#070808/);
  assert.match(light, /\.hooma-topbar[\s\S]*background:\s*#ffffff/);
  assert.match(light, /\.hooma-bottom-nav[\s\S]*background:\s*rgba\(255, 255, 255, 0\.96\)/);
  assert.match(light, /\.hooma-bottom-nav__item--active\s*\{[\s\S]*color:\s*#005fcc/);
  assert.match(light, /\.home-gateway-card\s*\{[\s\S]*background:\s*#0b0b09/);

  for (const selector of [
    ".play-page",
    ".hooma-page",
    ".athletes-page",
    ".teams-page",
    ".gamers-page",
    ".watch-page",
    ".ride-page",
    ".pitch-page",
    ".place-page",
    ".requests-page",
    ".gear-up-page",
    ".public-profile-page",
    ".admin-control-room",
  ]) {
    assert.ok(light.includes(selector), `missing complete Light Mode owner: ${selector}`);
  }
});

test("Light Mode fixes the exact Play and HOOMA regressions", async () => {
  const css = await readFile(lightCss, "utf8");

  assert.match(css, /\.play-page \.play-view-tabs[\s\S]*background:\s*#efefef/);
  assert.match(css, /\.play-page \.play-view-tab\.is-active[\s\S]*background:\s*#2f6f3e/);
  assert.match(css, /\.play-looking-options button[\s\S]*background:\s*#efefef/);
  assert.match(css, /\.pickup-match-card-meta__going[\s\S]*color:\s*#65676b !important/);
  assert.match(css, /\.play-event-card__ball[\s\S]*color:\s*#8a6500 !important/);
  assert.match(css, /\.hooma-page[\s\S]*\.panel[\s\S]*background:\s*#ffffff/);
  assert.match(css, /\.hooma-page[\s\S]*\.hooma-discovery-card[\s\S]*color:\s*#262626/);
  assert.match(css, /\.hooma-page \.hooma-domain-card[\s\S]*background:\s*#ffffff/);
});

test("Light Mode owns Watch empty-state body text", async () => {
  const css = await readFile(lightCss, "utf8");

  assert.match(css, /\.watch-page \.watch-empty-state p\s*\{[\s\S]*color:\s*#65676b/);
});

test("Light Mode owns the visible Athletes foregrounds placed on light cards", async () => {
  const css = await readFile(lightCss, "utf8");

  for (const selector of [
    ".athletes-sport-chips button",
    ".athletes-card h2",
    ".athletes-card p",
    ".athletes-card__footer small",
    ".athletes-card__footer span",
    ".athletes-page .athletes-field > span",
    ".athletes-page .athletes-field input",
    ".athletes-page .athletes-field textarea",
    ".athletes-page .athletes-choice-option",
    ".athletes-view-tab",
  ]) {
    assert.ok(css.includes(selector), `missing Light foreground owner: ${selector}`);
  }
});

test("Light Mode gives Teams primary and secondary controls independent readable colors", async () => {
  const css = await readFile(lightCss, "utf8");

  assert.match(
    css,
    /\.teams-page \.button:not\(\.secondary\)[\s\S]*background:\s*#2f6f3e;[\s\S]*color:\s*#ffffff;/,
  );
  assert.match(
    css,
    /\.teams-page \.button\.secondary[\s\S]*background:\s*#ffffff;[\s\S]*color:\s*#262626;/,
  );
});

test("Light Mode owns HOOMA list, create and detail roots and distinguishes media overlays", async () => {
  const [css, media] = await Promise.all([
    readFile(lightCss, "utf8"),
    readFile(communityMediaSource, "utf8"),
  ]);

  assert.match(
    css,
    /:root\[data-theme="light"\]\s+:is\(\.hooma-page, \.hooma-create-page, \.hooma-detail-page\)/,
  );
  assert.match(css, /\.hooma-create-preview\[data-has-media="false"\][\s\S]*color:\s*#050505/);
  assert.match(css, /\.hooma-create-preview\[data-has-media="true"\][\s\S]*color:\s*#ffffff/);
  assert.match(css, /\.hooma-create-form \.field > span[\s\S]*color:\s*#65676b/);
  assert.match(media, /data-has-media=\{loadedUrl \? "true" : "false"\}/);
});

test("Light profile overrides preserve Passport structure while removing dark surfaces", async () => {
  const [profile, light] = await Promise.all([
    readFile(profileCss, "utf8"),
    readFile(lightCss, "utf8"),
  ]);

  assert.doesNotMatch(profile, /\.public-profile-hero\b/);
  assert.match(profile, /\.hooma-passport-card\s*\{[\s\S]*background:\s*#070808/);
  assert.match(light, /\.hooma-passport-card\s*\{[\s\S]*background:\s*#ffffff/);
  assert.match(light, /\.hooma-passport-card h1\s*\{[\s\S]*color:\s*#050505/);
  assert.match(light, /\.hooma-passport-card__handle\s*\{[\s\S]*color:\s*#0866ff/);
  assert.match(light, /\.hooma-passport-card__ovr\s*\{[\s\S]*color:\s*#8a6500/);
  assert.match(light, /\.hooma-passport-stats[\s\S]*background:\s*#ffffff/);
});

test("every hardcoded dark CSS surface has an explicit Light Mode owner", async () => {
  const root = new URL("../", import.meta.url);
  const light = await readFile(lightCss, "utf8");
  const files = (
    await Promise.all([
      cssFiles(new URL("apps/web/src/", root)),
      cssFiles(new URL("packages/frontend/src/", root)),
      cssFiles(new URL("packages/ui/src/", root)),
    ])
  ).flat();
  const darkBackground =
    /(?:background|background-color)\s*:[^;]*(?:#0[0-9a-f]{5}|#1[0-9a-f]{5}|rgba?\(\s*(?:[0-3]?\d)[,\s]+(?:[0-3]?\d)[,\s]+(?:[0-3]?\d))/i;
  const uncovered = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [selector, body] = match.slice(1);
      if (!darkBackground.test(body)) continue;
      const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((item) => item[1]);
      if (classes.length > 0 && !classes.some((className) => light.includes(`.${className}`))) {
        uncovered.push(`${path.basename(file.pathname)}: ${selector.trim().replace(/\s+/g, " ")}`);
      }
    }
  }

  assert.ok(files.length >= 56, `expected the complete CSS inventory, received ${files.length}`);
  assert.deepEqual(uncovered, []);
});
