import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const athletesCss = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
const athletesApi = readFileSync("packages/frontend/src/athletes/api.ts", "utf8");
const athletesRoutes = readFileSync("apps/api/src/modules/athletes/http/athletes.routes.ts", "utf8");
const publicRouter = readFileSync("apps/api/src/http/public-v1/router.ts", "utf8");
const frontendApi = readFileSync("packages/frontend/src/api.ts", "utf8");

test("Athletes uses only the shared ATHLETES_TOP PageBanner for page-top presentation", () => {
  assert.ok(athletesPage.includes('import { PageBanner } from "../page-banner/PageBanner";'));
  assert.ok(athletesPage.includes('placementId="ATHLETES_TOP"'));
  assert.equal(athletesPage.includes("fallback={"), false);
  assert.equal(athletesPage.includes("pageBannerFallbackUrl"), false);
  assert.equal(athletesPage.includes("heroDelivery"), false);
  assert.equal(athletesCss.includes("page-banner__fallback--athletes"), false);
  assert.equal(athletesApi.includes("heroDelivery"), false);
  assert.equal(athletesRoutes.includes("/hero/delivery"), false);
  assert.match(publicRouter, /createAthletesPublicRouter\(container\.athletesService\)/);
  assert.ok(frontendApi.includes("const pageBanners = createPageBannerApi(transport);"));
  assert.equal(athletesPage.includes("/api/public/v1/banners"), false);
  assert.equal(athletesPage.includes("athletes-hero--hub"), false);
  assert.equal(athletesCss.includes("athletes-hero--hub"), false);
});
