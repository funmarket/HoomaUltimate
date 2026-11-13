import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SHELL_PRESENTATION,
  shellPresentationForPath,
} from "../apps/web/src/app/shell/page-presentation.js";

const shell = readFileSync("apps/web/src/app/shell/HoomaShell.tsx", "utf8");
const shellCss = readFileSync("apps/web/src/styles.css", "utf8");
const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const athletesCss = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
const athletesTabs = readFileSync("packages/frontend/src/athletes/AthletesHubTabs.tsx", "utf8");
const bannerCss = readFileSync("packages/frontend/src/page-banner/page-banner.css", "utf8");

test("ordinary shell pages stay STANDARD while the Athletes hub explicitly selects MEDIA_FIRST", () => {
  assert.equal(shellPresentationForPath("/"), SHELL_PRESENTATION.STANDARD);
  assert.equal(shellPresentationForPath("/play"), SHELL_PRESENTATION.STANDARD);
  assert.equal(shellPresentationForPath("/athletes/new"), SHELL_PRESENTATION.STANDARD);
  assert.equal(shellPresentationForPath("/athletes/community-1"), SHELL_PRESENTATION.STANDARD);
  assert.equal(shellPresentationForPath("/athletes"), SHELL_PRESENTATION.MEDIA_FIRST);
  assert.equal(shellPresentationForPath("/athletes/"), SHELL_PRESENTATION.MEDIA_FIRST);

  assert.match(shell, /shellPresentationForPath\(location\.pathname\)/);
  assert.match(shell, /foundation-shell--\$\{shellPresentation\}/);
  assert.match(shellCss, /\.foundation-shell\s*\{[\s\S]*?gap:\s*32px/);
  assert.match(shellCss, /\.foundation-shell--media-first\s*\{[\s\S]*?row-gap:\s*0/);
  assert.match(shellCss, /\.foundation-shell--media-first\s*\{[\s\S]*?align-content:\s*start/);
  assert.doesNotMatch(shellCss, /pathname|data-path|\[href[*^$|~]?=/);
});

test("Athletes hub orders PageBanner then Create Community then tabs with no CTA inside the banner", () => {
  const hub = athletesPage.slice(
    athletesPage.indexOf("export function AthletesPage"),
    athletesPage.indexOf("export function CreateAthletesPage"),
  );
  const bannerStart = hub.indexOf("<PageBanner");
  const createStart = hub.indexOf('className="athletes-actions athletes-hub-create"');
  const tabsStart = hub.indexOf("<AthletesHubTabs");

  assert.ok(bannerStart >= 0);
  assert.ok(createStart > bannerStart);
  assert.ok(tabsStart > createStart);

  const bannerMarkup = hub.slice(bannerStart, createStart);
  assert.ok(bannerMarkup.includes('placementId="ATHLETES_TOP"'));
  assert.equal(bannerMarkup.includes("fallback={"), false);
  assert.equal(bannerMarkup.includes("pageBannerFallbackUrl"), false);
  assert.equal(bannerMarkup.includes("page-banner__semantic-title--athletes"), false);
  assert.equal(bannerMarkup.includes("Create community"), false);
  assert.equal(bannerMarkup.includes("onCreateCommunity"), false);
  assert.equal(bannerMarkup.includes("athletes-hub-create"), false);

  assert.equal(hub.includes(".heroDelivery("), false);
  assert.ok(hub.includes("<AthletesHubTabs active={activeView} />"));
  assert.ok(hub.includes('activeView === "communities"'));
  assert.ok(hub.includes('activeView === "requests"'));
});

test("Athletes managed image uses shared full-frame geometry, with independent CTA and tabs", () => {
  assert.equal(bannerCss.includes("aspect-ratio: 18 / 13;"), false);
  assert.ok(bannerCss.includes("height: auto;"));
  assert.ok(bannerCss.includes("object-fit: contain;"));
  assert.equal(bannerCss.includes("aspect-ratio: 3 / 1;"), false);
  assert.equal(athletesCss.includes(".page-banner__fallback--athletes"), false);
  assert.equal(athletesCss.includes(".athletes-hero--hub"), false);
  assert.ok(athletesCss.includes(".athletes-hub-create {"));
  const createStart = athletesCss.indexOf(".athletes-hub-create {");
  const createEnd = athletesCss.indexOf("}", createStart);
  const createRule = athletesCss.slice(createStart, createEnd + 1);
  assert.equal(createRule.includes("margin-top: -"), false);
  assert.equal(createRule.includes("z-index"), false);
  assert.match(athletesTabs, />\s*Communities\s*</);
  assert.match(athletesTabs, />\s*Gear Up\s*</);
  assert.match(athletesTabs, />\s*Requests\s*</);
});
