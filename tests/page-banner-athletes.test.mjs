import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const athletesCss = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
const frontendApi = readFileSync("packages/frontend/src/api.ts", "utf8");

test("Athletes uses the shared ATHLETES_TOP PageBanner through the shared frontend API", () => {
  assert.ok(athletesPage.includes('import { PageBanner } from "../page-banner/PageBanner";'));
  assert.ok(athletesPage.includes('placementId="ATHLETES_TOP"'));
  assert.ok(athletesPage.includes('className="page-banner--athletes-hub"'));
  assert.equal(athletesPage.includes("page-banner__fallback"), false);
  assert.equal(athletesCss.includes(".page-banner__fallback"), false);
  assert.ok(frontendApi.includes("const pageBanners = createPageBannerApi(transport);"));
  assert.equal(athletesPage.includes("/api/public/v1/banners"), false);
  assert.equal(athletesPage.includes("athletes-hero--hub"), false);
  assert.equal(athletesCss.includes("athletes-hero--hub"), false);
});
