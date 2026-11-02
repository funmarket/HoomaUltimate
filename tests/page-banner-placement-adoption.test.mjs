import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const placements = [
  [
    "apps/web/src/home/HomePage.tsx",
    'import { HoomaNowSection, PageBanner } from "@hooma/frontend";',
    "HOME_TOP",
  ],
  [
    "packages/frontend/src/events/PlayPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "PLAY_TOP",
  ],
  [
    "packages/frontend/src/watch/WatchPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "WATCH_TOP",
  ],
  [
    "packages/frontend/src/communities/HoomaPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "HOOMA_TOP",
  ],
  [
    "packages/frontend/src/teams/TeamsPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "TEAMS_TOP",
  ],
  [
    "packages/frontend/src/pitch/PitchPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "PITCH_TOP",
  ],
  [
    "packages/frontend/src/places/PlacesPages.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "PLACES_TOP",
  ],
  [
    "packages/frontend/src/requests/RequestsPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "REQUESTS_TOP",
  ],
  [
    "packages/frontend/src/gear-up/GearUpPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "GEAR_UP_TOP",
  ],
  [
    "packages/frontend/src/rides/RideGatewayPage.tsx",
    'import { PageBanner } from "../page-banner/PageBanner";',
    "RIDE_TOP",
  ],
];

test("remaining public pages adopt the shared canonical PageBanner placement", async () => {
  for (const [path, importLine, placementId] of placements) {
    const source = await readFile(path, "utf8");

    assert.ok(source.includes(importLine), `${path} must import the shared PageBanner`);
    assert.ok(
      source.includes(`<PageBanner placementId="${placementId}" />`),
      `${path} must render ${placementId}`,
    );
    assert.equal(
      source.includes("/api/public/v1/banners"),
      false,
      `${path} must use the shared component rather than a direct public banner request`,
    );
  }
});

test("Athletes remains the existing shared PageBanner adopter without auto-rotation", async () => {
  const athletesPage = await readFile("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
  const runtime = await readFile("packages/frontend/src/page-banner/PageBanner.tsx", "utf8");

  assert.ok(athletesPage.includes('<PageBanner placementId="ATHLETES_TOP" />'));
  assert.ok(runtime.includes("publicRead(placementId)"));
  assert.equal(runtime.includes("setInterval"), false);
  assert.equal(runtime.includes("setTimeout"), false);
});
