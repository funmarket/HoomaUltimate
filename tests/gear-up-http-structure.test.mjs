import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Gear Up HTTP routers expose public discovery and member management surfaces", () => {
  const routePath = "apps/api/src/modules/gear-up/http/gear-up.routes.ts";
  const routeUrl = new URL(`../${routePath}`, import.meta.url);
  assert.equal(existsSync(routeUrl), true, "Gear Up HTTP routes must exist");

  const routes = source(routePath);

  for (const route of [
    'router\\.get\\(\\s*"/"',
    '"\/shops\/:placeId"',
    '"\/shops\/:placeId\/products"',
    '"\/products\/:productId"',
    '"\/products\/:productId\/images"',
    '"\/products\/:productId\/images\/:imageId\/delivery"',
    '"\/shops"',
    '"\/shops\/:placeId\/manage"',
    '"\/shops\/:placeId\/products\/manage"',
    '"\/shops\/:placeId\/products\/:productId\/feature"',
    '"\/shops\/:placeId\/products\/:productId\/archive"',
    '"\/shops\/:placeId\/products\/:productId\/images\/external"',
    '"\/shops\/:placeId\/products\/:productId\/images\/upload"',
    '"\/shops\/:placeId\/products\/:productId\/images\/order"',
    '"\/settings"',
  ]) {
    assert.match(routes, new RegExp(route));
  }

  assert.match(routes, /raw\(\{ type: "\*\/\*", limit: "5mb" \}\)/);
  assert.match(routes, /gearUpListQuerySchema\.parse\(request\.query\)/);
  assert.match(routes, /gearUpShopSuggestionSchema\.parse\(request\.body\)/);
  assert.match(routes, /gearUpProductCreateSchema\.parse\(request\.body\)/);
  assert.match(routes, /gearUpProductExternalImageInputSchema\.parse\(request\.body\)/);
  assert.match(routes, /gearUpProductImageOrderSchema\.parse\(request\.body\)/);
  assert.match(routes, /getAuth\(request\)\.userId/);
});

test("Gear Up services are composed once in the API container and mounted in both routers", () => {
  const container = source("apps/api/src/bootstrap/container.ts");
  const publicRouter = source("apps/api/src/http/public-v1/router.ts");
  const memberRouter = source("apps/api/src/http/v1/router.ts");

  for (const name of [
    "gearUpService",
    "gearUpProductService",
    "gearUpProductMediaService",
    "gearUpSettingsService",
  ]) {
    assert.match(container, new RegExp(name));
  }

  assert.match(publicRouter, /createGearUpPublicRouter/);
  assert.match(publicRouter, /router\.use\(\s*"\/gear-up"/);
  assert.match(memberRouter, /createGearUpMemberRouter/);
  assert.match(memberRouter, /router\.use\(\s*"\/gear-up"/);
});

test("Gear Up moderation stays inside the canonical platform Admin queue surface", () => {
  const adminRoutes = source("apps/api/src/modules/platform-admin/http/platform-admin.routes.ts");
  const memberRouter = source("apps/api/src/http/v1/router.ts");

  assert.match(adminRoutes, /GearUpService/);
  assert.match(adminRoutes, /GearUpSettingsService/);
  assert.match(adminRoutes, /"\/queues\/gear-up"/);
  assert.match(adminRoutes, /"\/queues\/gear-up\/:placeId\/decision"/);
  assert.match(adminRoutes, /"\/gear-up\/settings"/);

  assert.match(
    memberRouter,
    /createPlatformAdminRouter\([\s\S]*?container\.gearUpService[\s\S]*?container\.gearUpSettingsService/,
  );
});

test("Gear Up domain errors map to HTTP status codes instead of falling through to 500", () => {
  const handler = source("apps/api/src/http/errors/error-handler.ts");

  assert.match(handler, /GearUpError/);
  assert.match(handler, /GEAR_UP_STATUS/);
  assert.match(handler, /GEAR_UP_SHOP_NOT_FOUND:\s*404/);
  assert.match(handler, /GEAR_UP_PRODUCT_NOT_FOUND:\s*404/);
  assert.match(handler, /GEAR_UP_PRODUCT_MANAGE_FORBIDDEN:\s*403/);
  assert.match(handler, /GEAR_UP_PRODUCT_IMAGE_TOO_LARGE:\s*413/);
  assert.match(handler, /GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID:\s*415/);
  assert.match(handler, /GEAR_UP_PRODUCT_IMAGE_LIMIT_REACHED:\s*409/);
});
