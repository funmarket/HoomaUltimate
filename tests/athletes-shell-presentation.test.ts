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

test("Athletes hub orders artwork then Create Community then tabs with no CTA inside the hero", () => {
  const hub = athletesPage.slice(
    athletesPage.indexOf("export function AthletesPage"),
    athletesPage.indexOf("export function CreateAthletesPage"),
  );
  const heroStart = hub.search(
    /<section\s+className="athletes-surface athletes-hero athletes-hero--hub"(?:\s|>)/,
  );
  const heroEnd = hub.indexOf("</section>", heroStart);
  const createStart = hub.indexOf('className="athletes-actions athletes-hub-create"');
  const tabsStart = hub.indexOf("<AthletesHubTabs");

  assert.ok(heroStart >= 0);
  assert.ok(heroEnd > heroStart);
  assert.ok(createStart > heroEnd);
  assert.ok(tabsStart > createStart);

  const heroMarkup = hub.slice(heroStart, heroEnd);
  assert.match(heroMarkup, /className="athletes-hero__banner"/);
  assert.match(heroMarkup, /src=\{heroUrl\}/);
  assert.match(heroMarkup, /athletes-hero__semantic-title/);
  assert.doesNotMatch(heroMarkup, /Create community|onCreateCommunity|athletes-hub-create/);

  assert.match(hub, /api\.athletes[\s\S]*?\.heroDelivery\(controller\.signal\)/);
  assert.match(hub, /<AthletesHubTabs active=\{activeView\} \/>/);
  assert.match(hub, /activeView === "communities"/);
  assert.match(hub, /activeView === "requests"/);
});

test("Athletes hero keeps 720x520 contain geometry and removes the hub overlay content rule", () => {
  const hubRule =
    athletesCss.match(/\.athletes-hero(?:\.athletes-hero--hub|--hub)\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const bannerRule = athletesCss.match(/\.athletes-hero__banner\s*\{[\s\S]*?\}/)?.[0] ?? "";

  assert.match(hubRule, /aspect-ratio:\s*720\s*\/\s*520/);
  assert.match(bannerRule, /object-fit:\s*contain/);
  assert.doesNotMatch(athletesCss, /\.athletes-hero--hub \.athletes-hero__content\s*\{/);
  assert.match(athletesCss, /\.athletes-hub-create\s*\{/);
  const createRule = athletesCss.match(/\.athletes-hub-create\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.doesNotMatch(createRule, /margin[^;]*:\s*-/);
  assert.doesNotMatch(createRule, /z-index/);

  assert.match(athletesTabs, />\s*Communities\s*</);
  assert.match(athletesTabs, />\s*Gear Up\s*</);
  assert.match(athletesTabs, />\s*Requests\s*</);
});
