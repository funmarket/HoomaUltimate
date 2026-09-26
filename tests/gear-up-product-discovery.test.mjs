import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL("../" + path, import.meta.url), "utf8");
}

test("Gear Up products expose one global public discovery contract without a second persistence model", () => {
  const contracts = source("packages/contracts/src/gear-up.ts");
  const schema = source("packages/database/prisma/gear-up.prisma");

  assert.match(contracts, /gearUpProductDiscoveryQuerySchema/);
  assert.match(contracts, /PublicGearUpProductListing/);
  assert.match(contracts, /GearUpProductDiscoveryPage/);
  for (const field of [
    "q",
    "offer",
    "sport",
    "category",
    "city",
    "houma",
    "featured",
    "cursor",
    "limit",
  ]) {
    assert.match(contracts, new RegExp(field));
  }

  assert.doesNotMatch(schema, /model\s+(GlobalProduct|MarketplaceProduct|FeedProduct)/);
});

test("public product discovery is a direct server-side query with cursor pagination", () => {
  const repository = source(
    "apps/api/src/modules/gear-up/infrastructure/prisma-gear-up-product.repository.ts",
  );
  const routes = source("apps/api/src/modules/gear-up/http/gear-up.routes.ts");

  assert.match(repository, /listPublic/);
  assert.match(repository, /take:\s*input\.limit \+ 1/);
  assert.match(repository, /cursor:/);
  assert.match(repository, /archivedAt:\s*null/);
  assert.match(repository, /moderationStatus:\s*"APPROVED"/);
  assert.match(repository, /kind:\s*"GEAR_UP"/);
  assert.match(routes, /router\.get\(\s*"\/products"/);
  assert.match(routes, /gearUpProductDiscoveryQuerySchema\.parse\(request\.query\)/);
  assert.doesNotMatch(routes, /Promise\.all\(.*shops.*products/s);
});

test("Products mode is live and uses a cross-store product pane", () => {
  for (const path of [
    "packages/frontend/src/gear-up/GearUpProductsPane.tsx",
    "packages/frontend/src/gear-up/GearUpProductFilters.tsx",
    "packages/frontend/src/gear-up/GearUpProductDetailPage.tsx",
  ]) {
    assert.equal(existsSync(new URL("../" + path, import.meta.url)), true, path + " must exist");
  }

  const page = source("packages/frontend/src/gear-up/GearUpPage.tsx");
  assert.match(page, /Stores/);
  assert.match(page, /Products/);
  assert.match(page, /GearUpProductsPane/);
  assert.doesNotMatch(page, /title="Product discovery will be enabled/);
  assert.doesNotMatch(page, /aria-disabled="true"[\s\S]*Products/);
});

test("cross-store product cards retain originating shop identity and both navigation choices", () => {
  const pane = source("packages/frontend/src/gear-up/GearUpProductsPane.tsx");
  const card = source("packages/frontend/src/gear-up/GearUpProductPreviewCard.tsx");

  assert.match(pane, /listProducts/);
  assert.match(pane, /No products match these filters yet\./);
  assert.match(card, /shop/);
  assert.match(card, /View Product/);
  assert.match(card, /View Shop/);
  assert.match(pane, /\/athletes\/gear-up\/products\//);
  assert.match(pane, /\/athletes\/gear-up\/shops\//);
  assert.match(card, /Ask shop for current price/);
  assert.doesNotMatch(card, /Buy Now|Add to Cart|stock|shipping/i);
});

test("Product Detail uses the existing canonical product shop and image APIs", () => {
  const page = source("packages/frontend/src/gear-up/GearUpProductDetailPage.tsx");
  const api = source("packages/frontend/src/gear-up/api.ts");
  const router = source("apps/web/src/app/router/HoomaRouter.tsx");

  assert.match(page, /getProduct/);
  assert.match(page, /getShop/);
  assert.match(page, /listProductImages/);
  assert.match(page, /productImageDelivery/);
  assert.match(page, /View Shop/);
  assert.match(page, /Ask shop for current price/);
  assert.match(api, /listProducts/);
  assert.match(api, /getProduct/);
  assert.match(api, /listProductImages/);
  assert.match(router, /path="\/athletes\/gear-up\/products\/:productId"/);
  assert.match(router, /path="\/gear-up\/products\/:productId" element=\{<LegacyGearUpProductRoute \/>\}/);

  assert.doesNotMatch(page, /checkout|Buy Now|Add to Cart|stock|shipping/i);
});
