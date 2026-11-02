import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const frontendApi = readFileSync("packages/frontend/src/api.ts", "utf8");

test("Athletes is the first public PageBanner adopter through the shared frontend API", () => {
  assert.match(athletesPage, /import \{ PageBanner \} from "\.\.\/page-banner\/PageBanner";/);
  assert.match(athletesPage, /<PageBanner placementId="ATHLETES_TOP" \/>/);
  assert.match(frontendApi, /const pageBanners = createPageBannerApi\(transport\);/);
  assert.match(frontendApi, /return \{[\s\S]*pageBanners[\s\S]*\};/);
  assert.doesNotMatch(athletesPage, /fetch\([^)]*banners|\/api\/public\/v1\/banners/);
});
