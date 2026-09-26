import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("Gear Up shop detail has a dedicated route and exported frontend page", () => {
  const pagePath = "packages/frontend/src/gear-up/GearUpShopDetailPage.tsx";
  const productPath = "packages/frontend/src/gear-up/GearUpProductPreviewCard.tsx";
  assert.equal(existsSync(new URL("../" + pagePath, import.meta.url)), true);
  assert.equal(existsSync(new URL("../" + productPath, import.meta.url)), true);

  const entry = source("packages/frontend/src/index.ts");
  const router = source("apps/web/src/app/router/HoomaRouter.tsx");
  assert.match(entry, /GearUpShopDetailPage/);
  assert.match(router, /GearUpShopDetailPage/);
  assert.match(router, /path="\/gear-up\/shops\/:placeId"/);
});

test("Gear Up public API exposes canonical shop detail, shop products and product cover delivery", () => {
  const api = source("packages/frontend/src/gear-up/api.ts");
  assert.match(api, /getShop/);
  assert.match(api, /listShopProducts/);
  assert.match(api, /productImageDelivery/);
  assert.match(api, /\/api\/public\/v1\/gear-up\/shops\//);
  assert.match(api, /images\/.*delivery/);
});

test("shop discovery cards now enter the dedicated Gear Up shop detail", () => {
  const card = source("packages/frontend/src/gear-up/GearUpShopCard.tsx");
  assert.match(card, /\/gear-up\/shops\//);
  assert.doesNotMatch(card, /href=.*\/places\//);
});

test("Gear Up shop detail renders only canonical fields supported by live contracts", () => {
  const page = source("packages/frontend/src/gear-up/GearUpShopDetailPage.tsx");
  for (const term of [
    "Verified Owner",
    "By Owner",
    "FanHub",
    "Payment accepted",
    "Cash",
    "Crypto",
    "Card by phone",
    "Call Shop",
    "Directions",
    "Website",
    "What you’ll find",
    "About This Shop",
  ]) {
    assert.match(page, new RegExp(term));
  }
  assert.match(page, /PlaceGallery/);
  assert.match(page, /shop\.place\.images/);
  assert.match(page, /shop\.paymentMethods/);
  assert.match(page, /shop\.categories/);
  assert.match(page, /shop\.sports/);
  assert.doesNotMatch(page, /Instagram|Opening hours|rating|review|stock|checkout|Buy Now/i);
});

test("shop detail previews canonical products without inventing the later product-detail route", () => {
  const page = source("packages/frontend/src/gear-up/GearUpShopDetailPage.tsx");
  const card = source("packages/frontend/src/gear-up/GearUpProductPreviewCard.tsx");

  assert.match(page, /listShopProducts/);
  assert.match(page, /featuredAt/);
  assert.match(page, /This shop hasn’t added products yet\./);
  assert.match(page, /Call Shop|Directions/);

  assert.match(card, /product\.title/);
  assert.match(card, /product\.brand/);
  assert.match(card, /product\.category/);
  assert.match(card, /product\.price/);
  assert.match(card, /Ask shop for current price/);
  assert.match(card, /imageUrl/);
  assert.doesNotMatch(card, /gear-up\/products|Buy Now|Add to Cart/i);
});

test("shop detail styling stays on the global HOOMA visual tokens", () => {
  const css = source("packages/frontend/src/gear-up/gear-up.css");
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
    assert.match(css, new RegExp("var\\(" + token + "\\)"));
  }
  assert.doesNotMatch(css, /border:\s*[2-9]px/);
  assert.doesNotMatch(css, /background:\s*var\(--hooma-ui-accent\)/);
});
