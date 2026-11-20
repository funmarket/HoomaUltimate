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

test("Light appearance exposes the complete Meta-style HOOMA palette", async () => {
  const css = await readFile(themeCss, "utf8");
  const light = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(light, /--app-bg:\s*#f0f2f5/);
  assert.match(light, /--app-surface:\s*#ffffff/);
  assert.match(light, /--app-subtle:\s*#efefef/);
  assert.match(light, /--app-text-strong:\s*#050505/);
  assert.match(light, /--app-text:\s*#262626/);
  assert.match(light, /--app-text-secondary:\s*#65676b/);
  assert.match(light, /--app-text-caption:\s*#65676b/);
  assert.match(light, /--app-accent:\s*#0866ff/);
  assert.match(light, /--app-accent-hover:\s*#075ce5/);
  assert.match(light, /--app-accent-soft:\s*#e7f3ff/);
  assert.match(light, /--app-gold:\s*#65676b/);
  assert.match(light, /--app-gold-dim:\s*#65676b/);
  assert.match(light, /--app-positive:\s*#15803d/);
  assert.match(light, /--app-positive-soft:\s*#dcfce7/);
  assert.match(light, /--hooma-ui-bg:\s*#f0f2f5/);
  assert.match(light, /--hooma-ui-surface:\s*#ffffff/);
  assert.match(light, /--hooma-ui-text:\s*#050505/);
  assert.match(light, /--hooma-ui-accent:\s*#0866ff/);
});

test("Light palette text and primary actions preserve readable contrast", () => {
  assert.ok(contrastRatio("#262626", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#65676b", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#ffffff", "#0866ff") >= 4.5);
  assert.ok(contrastRatio("#65676b", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#075ce5", "#f0f2f5") >= 4.5);
  assert.ok(contrastRatio("#15803d", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#005fcc", "#f0f2f5") >= 4.5);
  assert.ok(contrastRatio("#705000", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#a33c00", "#ffffff") >= 4.5);
});

test("Light Mode retires the green-action, brown-gold and warm-beige palette", async () => {
  const [theme, light] = await Promise.all([
    readFile(themeCss, "utf8"),
    readFile(lightCss, "utf8"),
  ]);
  const themeLight = theme.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const retired = /#(?:2f6f3e|245c33|eaf5ed|8a6500|6f5200|fff8e1|fff8e5)\b/i;

  assert.doesNotMatch(themeLight, retired);
  assert.doesNotMatch(light, retired);
  assert.doesNotMatch(light, /rgba\(138,\s*101,\s*0,\s*0\.24\)/i);
  assert.match(light, /:root\[data-theme="light"\] \.eyebrow\s*\{\s*color:\s*#65676b/);
  assert.match(light, /:root\[data-theme="light"\] \.auth-card a\s*\{\s*color:\s*#0866ff/);
});

test("Light Pitch toolbar and Passport accents use strong foreground colors", async () => {
  const light = await readFile(lightCss, "utf8");

  assert.match(light, /\.pitch-back-link[\s\S]*color:\s*#075ce5/);
  assert.match(light, /\.pitch-owner-link[\s\S]*color:\s*#075ce5/);
  assert.match(light, /\.hooma-passport-card__handle[\s\S]*color:\s*#005fcc/);
  assert.match(light, /\.hooma-passport-card__ovr[\s\S]*color:\s*#705000/);
  assert.match(light, /\.hooma-passport-card__pos[\s\S]*color:\s*#a33c00/);
  assert.match(light, /\[data-identity="PLAYER"\][\s\S]*color:\s*#075ce5/);
  assert.match(light, /\[data-identity="FAN"\][\s\S]*color:\s*#005fcc/);
  assert.match(light, /\[data-identity="GAMER"\][\s\S]*color:\s*#a33c00/);
  assert.match(light, /\.hooma-passport-stats \.is-yellow[\s\S]*color:\s*#705000/);
  assert.match(light, /\.hooma-passport-stats \.is-orange[\s\S]*color:\s*#a33c00/);
  assert.match(light, /\.hooma-passport-stats \.is-green[\s\S]*color:\s*#15803d/);
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
  assert.match(css, /\.play-page \.play-view-tab\.is-active[\s\S]*background:\s*#0866ff/);
  assert.match(css, /\.play-looking-options button[\s\S]*background:\s*#efefef/);
  assert.match(css, /\.pickup-match-card-meta__going[\s\S]*color:\s*#65676b !important/);
  assert.match(css, /\.play-event-card__ball[\s\S]*color:\s*#65676b !important/);
  assert.match(css, /\.hooma-page[\s\S]*\.panel[\s\S]*background:\s*#ffffff/);
  assert.match(css, /\.hooma-page[\s\S]*\.hooma-discovery-card[\s\S]*color:\s*#262626/);
  assert.match(css, /\.hooma-page \.hooma-domain-card[\s\S]*background:\s*#ffffff/);
});

test("Light active tabs and selected chips use the shared blue state treatment", async () => {
  const css = await readFile(lightCss, "utf8");

  assert.match(
    css,
    /athletes-sport-chips button\.is-active[\s\S]*border-color:\s*#0866ff;[\s\S]*background:\s*#e7f3ff;[\s\S]*color:\s*#075ce5/,
  );
  assert.match(
    css,
    /teams-tab\.active[\s\S]*border-color:\s*#0866ff;[\s\S]*background:\s*#e7f3ff;[\s\S]*color:\s*#075ce5/,
  );
  assert.match(
    css,
    /team-profile-page \.chip\.selected[\s\S]*border-color:\s*#0866ff;[\s\S]*background:\s*#e7f3ff;[\s\S]*color:\s*#075ce5/,
  );
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
  assert.match(light, /\.hooma-passport-card__handle\s*\{[\s\S]*color:\s*#005fcc/);
  assert.match(light, /\.hooma-passport-card__ovr\s*\{[\s\S]*color:\s*#705000/);
  assert.match(light, /\.hooma-passport-stats[\s\S]*background:\s*#ffffff/);
});

test("Light owns application surfaces while media artwork stays domain-owned", async () => {
  const root = new URL("../", import.meta.url);
  const light = await readFile(lightCss, "utf8");
  const protectedMediaSurfaces = new Set([
    "gamer-disputes.css: .gamer-dispute-evidence-grid img, .gamer-dispute-proof-missing",
    "hooma-membership.css: .hooma-member-avatar",
    "profile.css: .hooma-passport-card__photo",
    "athletes-photo-board.css: .athletes-photo-board__delete",
    "athletes-photo-board.css: .athletes-photo-board__delete-confirm",
    "athletes-photo-board.css: .athletes-photo-board__delete-error",
    "athletes-photo-board.css: .athletes-photo-board__photo-error, .athletes-photo-board__photo-loading",
    "communities.css: .hooma-card-media",
    "communities.css: .hooma-hq-logo, .hooma-preview-logo",
    "community-media.css: .hooma-card-logo",
    "formation-builder-pitch.css: .formation-pitch--stadium",
    "formation-builder-pitch.css: .formation-pitch--stadium::before",
    "formation-builder-pitch.css: .formation-pitch--stadium::after",
    "formation-builder-pitch.css: .formation-pitch__surface",
    "formation-builder-pitch.css: .formation-slot__marker--game",
    "formation-builder-pitch.css: .formation-slot__position",
    "formation-builder-pitch.css: .formation-slot__name",
    "formation-builder-pitch.css: .formation-bench-player__portrait",
    "play-player-listing.css: .play-player-card__portrait, .play-sheet__avatar",
    "play.css: .pickup-match-card-pro__pitch-mark",
    "play.css: .formation-pitch",
    "play.css: .formation-slot__marker",
    "watch-event-detail.css: .watch-event-detail__venue-image",
    "watch-event-detail.css: .watch-event-detail__venue-placeholder",
    "gamers.css: .gamer-card-portrait-panel",
    "gamers.css: .gamer-avatar",
    "gamers.css: .gamer-card-portrait-panel .gamer-open-badge",
    "page-banner.css: .page-banner__frame",
    "page-banner.css: .page-banner__controls",
    "pitch-detail.css: .pitch-hero",
    "pitch.css: .pitch-ticket__photo",
    "pitch.css: .pitch-ticket__photo > img",
    "pitch.css: .pitch-detail-gallery",
    "place-gallery.css: .place-gallery__arrow",
    "places.css: .place-venue-badge",
    "rides.css: .ride-offer-card__media, .ride-detail-card__photo, .ride-recent-card__media, .ride-recent-card__avatar",
    "rides.css: .ride-map-preview",
    "rides.css: .ride-map-preview__image",
    "TeamLineupPitch.css: .team-lineup-field",
    "TeamLineupPitch.css: .team-lineup-field::after",
    "TeamLineupPitch.css: .team-lineup-avatar",
    "TeamLineupPitch.css: .team-lineup-nameplate",
    "TeamLineupPitch.css: .team-lineup-empty",
    "TeamLineupPitch.css: .team-lineup-empty-mark",
    "team-media.css: .team-media-banner",
    "team-media.css: .team-media-banner__overlay",
    "teams.css: .team-profile-badge",
    "watch.css: .watch-ticket__photo-panel",
    "watch.css: .watch-ticket__photo-panel img",
  ]);
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
  const preservedMedia = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [selector, body] = match.slice(1);
      if (!darkBackground.test(body)) continue;
      const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((item) => item[1]);
      if (classes.length > 0 && !classes.some((className) => light.includes(`.${className}`))) {
        const surface = `${path.basename(file.pathname)}: ${selector.trim().replace(/\s+/g, " ")}`;
        if (protectedMediaSurfaces.has(surface)) preservedMedia.push(surface);
        else uncovered.push(surface);
      }
    }
  }

  assert.ok(files.length >= 56, `expected the complete CSS inventory, received ${files.length}`);
  assert.deepEqual(preservedMedia.sort(), [...protectedMediaSurfaces].sort());
  assert.deepEqual(uncovered, []);
});
