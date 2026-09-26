import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Gear Up Add Store has a dedicated frontend page and Athletes route", () => {
  const pagePath = "packages/frontend/src/gear-up/AddGearUpShopPage.tsx";
  assert.equal(existsSync(new URL(`../${pagePath}`, import.meta.url)), true, `${pagePath} must exist`);

  const entry = source("packages/frontend/src/index.ts");
  const router = source("apps/web/src/app/router/HoomaRouter.tsx");

  assert.match(entry, /export \* from "\.\/gear-up\/AddGearUpShopPage"/);
  assert.match(router, /AddGearUpShopPage/);
  assert.match(router, /path="\/athletes\/gear-up\/add-store"/);
});

test("Gear Up Add Store reuses canonical PlaceForm and posts through Gear Up only", () => {
  const page = source("packages/frontend/src/gear-up/AddGearUpShopPage.tsx");
  const api = source("packages/frontend/src/gear-up/api.ts");

  assert.match(page, /PlaceForm/);
  assert.match(page, /showMenu=\{false\}/);
  assert.match(page, /gearUpShopSuggestionSchema\.safeParse/);
  assert.match(page, /suggestShop\(parsed\.data\)/);
  assert.match(api, /suggestShop/);
  assert.match(api, /\/api\/v1\/gear-up\/shops/);
  assert.match(api, /method:\s*"POST"/);

  assert.doesNotMatch(page, /createPlacesApi|\/api\/v1\/places/);
  assert.doesNotMatch(api, /suggestShop[\s\S]*?\/api\/v1\/places/);
});

test("Gear Up Add Store preserves source, classification, payment and photo rules", () => {
  const page = source("packages/frontend/src/gear-up/AddGearUpShopPage.tsx");
  const placeForm = source("packages/frontend/src/places/PlaceForm.tsx");

  for (const label of ["By Owner", "FanHub", "Sportswear", "Gear", "Cash", "Card by phone"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /ATHLETES_SPORTS/);
  assert.match(page, /GEAR_UP_PRODUCT_CATEGORY_LABELS/);
  assert.match(page, /submissionOrigin/);
  assert.match(page, /paymentMethods/);

  assert.doesNotMatch(page, />\s*Crypto\s*</);
  assert.doesNotMatch(page, /walletAddress|wallet address|raw wallet/i);

  assert.match(placeForm, /Array\.from\(\{ length: 4 \}/);
  assert.match(placeForm, /\.slice\(0, 4\)/);
});

test("Gear Up Add Store requires an HOOMA account with the existing frontend auth pattern", () => {
  const page = source("packages/frontend/src/gear-up/AddGearUpShopPage.tsx");

  assert.match(page, /api\.identity\.meOptional\(\)/);
  assert.match(page, /authenticationHref\("\/athletes\/gear-up\/add-store"\)/);
  assert.match(page, /Sign in to continue/);
});

test("Gear Up discovery exposes the real Add Store path and removes the generic Places CTA", () => {
  const page = source("packages/frontend/src/gear-up/GearUpPage.tsx");

  assert.match(page, /href="\/athletes\/gear-up\/add-store"/);
  assert.match(page, />\s*Add Store\s*</);
  assert.doesNotMatch(page, /href="\/places\/new"/);
});

test("Gear Up Add Store handles canonical new and existing Place outcomes", () => {
  const page = source("packages/frontend/src/gear-up/AddGearUpShopPage.tsx");

  assert.match(page, /outcome === "EXISTING"/);
  assert.match(page, /status === "APPROVED"/);
  assert.match(page, /status === "PENDING"/);
  assert.match(page, /No duplicate created/);
  assert.match(page, /App Admin/);
  assert.match(page, /\/athletes\/gear-up\/shops\/\$\{placeId\}/);
  assert.match(page, /verified ownership|verification remains separate/i);
});
