import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Gear Up public discovery owns a real frontend route and exported feature boundary", () => {
  for (const path of [
    "packages/frontend/src/gear-up/api.ts",
    "packages/frontend/src/gear-up/GearUpPage.tsx",
    "packages/frontend/src/gear-up/GearUpFilters.tsx",
    "packages/frontend/src/gear-up/GearUpShopCard.tsx",
    "packages/frontend/src/gear-up/gear-up.css",
    "packages/frontend/src/athletes/AthletesHubTabs.tsx",
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`);
  }

  const entry = source("packages/frontend/src/index.ts");
  const router = source("apps/web/src/app/router/HoomaRouter.tsx");
  assert.match(entry, /\.\/gear-up\/gear-up\.css/);
  assert.match(entry, /export \* from "\.\/gear-up\/GearUpPage"/);
  assert.match(router, /GearUpPage/);
  assert.match(router, /path="\/athletes\/gear-up" element=\{<GearUpPage \/>\}/);
  assert.match(router, /path="\/gear-up" element=\{<Navigate to="\/athletes\/gear-up" replace \/>\}/);
});

test("Athletes owns Gear Up presentation navigation while Watch remains Events and Spots", () => {
  const athletesTabs = source("packages/frontend/src/athletes/AthletesHubTabs.tsx");
  const athletes = source("packages/frontend/src/athletes/AthletesPages.tsx");
  const gearUp = source("packages/frontend/src/gear-up/GearUpPage.tsx");
  const watchNav = source("packages/frontend/src/watch/WatchSectionNavigation.tsx");
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  const places = source("packages/frontend/src/places/PlacesPages.tsx");

  for (const label of ["Communities", "Gear Up", "Requests"]) {
    assert.match(athletesTabs, new RegExp(`>\\s*${label}\\s*<`));
  }
  assert.match(athletesTabs, /to="\/athletes"/);
  assert.match(athletesTabs, /to="\/athletes\/gear-up"/);
  assert.match(athletesTabs, /to="\/athletes\?tab=requests"/);
  assert.match(athletes, /<AthletesHubTabs active=\{activeView\} \/>/);
  assert.match(gearUp, /<AthletesHubTabs active="gear-up" \/>/);

  for (const label of ["Events", "Spots", "Create Event", "Add a Place"]) {
    assert.match(watchNav, new RegExp(`>\\s*${label}\\s*<`));
  }
  assert.doesNotMatch(watchNav, />\\s*Gear Up\\s*</);
  assert.doesNotMatch(watchNav, /href="\/gear-up"/);
  assert.match(watch, /<WatchSectionNavigation[\s\S]*active="events"/);
  assert.match(places, /<WatchSectionNavigation[\s\S]*active="spots"/);
});

test("Gear Up API maps canonical public filter fields to the real public HTTP surface", () => {
  const api = source("packages/frontend/src/gear-up/api.ts");
  assert.match(api, /\/api\/public\/v1\/gear-up/);
  for (const field of ["q", "source", "offer", "sport", "category", "city", "houma", "limit"]) {
    assert.match(api, new RegExp(`params\\.set\\("${field}"`));
  }
  assert.match(api, /PublicGearUpShop/);
  assert.doesNotMatch(api, /mock|fixture|demo/i);
});

test("Gear Up discovery presents the approved filters and truthful canonical shop cards", () => {
  const page = source("packages/frontend/src/gear-up/GearUpPage.tsx");
  const filters = source("packages/frontend/src/gear-up/GearUpFilters.tsx");
  const card = source("packages/frontend/src/gear-up/GearUpShopCard.tsx");

  assert.match(page, /Discover shops offering gear and sportswear\./);
  assert.match(page, /gear-up-discovery-mode/);
  assert.match(page, />\s*Stores\s*</);
  assert.match(page, />\s*Products\s*</);
  assert.doesNotMatch(page, /aria-disabled="true"/);
  assert.match(page, /No shops match these filters yet\./);
  assert.match(page, /Clear filters/);
  assert.match(page, /href="\/places\/new"/);

  for (const label of ["Sportswear", "Gear", "By Owner", "FanHub", "City", "Houma"]) {
    assert.match(filters, new RegExp(label));
  }
  assert.match(filters, /GEAR_UP_PRODUCT_CATEGORY_LABELS/);
  assert.match(filters, /ATHLETES_SPORTS/);

  assert.match(card, /shop\.place\.imageUrl/);
  assert.match(card, /shop\.place\.name/);
  assert.match(card, /shop\.place\.submissionOrigin/);
  assert.match(card, /shop\.verifiedOwner/);
  assert.match(card, /shop\.sports/);
  assert.match(card, /shop\.categories/);
  assert.match(card, /shop\.offerTypes/);
  assert.match(card, /View Shop/);
  assert.match(card, /\/athletes\/gear-up\/shops\/\$\{shop\.place\.id\}/);
  assert.doesNotMatch(card, /distance|km away|nearest/i);
  assert.doesNotMatch(
    card,
    /verifiedOwner\s*=\s*.*submissionOrigin|submissionOrigin\s*===.*verified/i,
  );
});

test("Gear Up discovery uses the canonical HOOMA structural tokens instead of a feature-local visual system", () => {
  const css = source("packages/frontend/src/gear-up/gear-up.css");
  const navCss = source("packages/frontend/src/watch/watch-section-actions.css");

  for (const token of [
    "--hooma-ui-bg",
    "--hooma-ui-surface",
    "--hooma-ui-surface-raised",
    "--hooma-ui-outline",
    "--hooma-ui-text",
    "--hooma-ui-text-description",
    "--hooma-ui-text-meta",
    "--hooma-ui-accent",
    "--hooma-ui-radius-card",
    "--hooma-ui-radius-control",
    "--hooma-ui-card-title",
    "--hooma-ui-body",
    "--hooma-ui-meta",
  ]) {
    assert.match(css, new RegExp(`var\\(${token}\\)`));
  }

  assert.match(css, /border:\s*1px solid var\(--hooma-ui-outline\)/);
  assert.match(navCss, /var\(--hooma-ui-outline\)/);
  assert.match(navCss, /#a9b0b4/i);
  assert.doesNotMatch(css, /border:\s*[2-9]px/);
  assert.doesNotMatch(css, /background:\s*var\(--hooma-ui-accent\)/);
});
