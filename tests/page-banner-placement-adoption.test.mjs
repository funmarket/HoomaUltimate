import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const placements = [
  ["apps/web/src/home/HomePage.tsx", "HOME_TOP"],
  ["packages/frontend/src/events/PlayPage.tsx", "PLAY_TOP"],
  ["packages/frontend/src/watch/WatchPage.tsx", "WATCH_TOP"],
  ["packages/frontend/src/communities/HoomaPage.tsx", "HOOMA_TOP"],
  ["packages/frontend/src/teams/TeamsPage.tsx", "TEAMS_TOP"],
  ["packages/frontend/src/pitch/PitchPage.tsx", "PITCH_TOP"],
  ["packages/frontend/src/places/PlacesPages.tsx", "PLACES_TOP"],
  ["packages/frontend/src/requests/RequestsPage.tsx", "REQUESTS_TOP"],
  ["packages/frontend/src/gear-up/GearUpPage.tsx", "GEAR_UP_TOP"],
  ["packages/frontend/src/rides/RideGatewayPage.tsx", "RIDE_TOP"],
];

test("remaining public pages adopt the shared canonical PageBanner placement", async () => {
  const contents = await Promise.all(
    placements.map(async ([path, placementId]) => ({
      path,
      placementId,
      source: await readFile(path, "utf8"),
    })),
  );

  for (const { path, placementId, source } of contents) {
    assert.match(
      source,
      /import \{ PageBanner \} from "(?:\.\.\/)+page-banner\/PageBanner";/,
      `${path} must import the shared PageBanner component`,
    );
    assert.match(
      source,
      new RegExp(`<PageBanner placementId="${placementId}" />`),
      `${path} must use ${placementId}`,
    );
    assert.doesNotMatch(
      source,
      /\/api\/public\/v1\/banners|fetch\\([^)]*banners/,
      `${path} must not own a second PageBanner API client`,
    );
  }
});

test("the shared PageBanner runtime remains the only public banner owner", async () => {
  const [athletes, runtime] = await Promise.all([
    readFile("packages/frontend/src/athletes/AthletesPages.tsx", "utf8"),
    readFile("packages/frontend/src/page-banner/PageBanner.tsx", "utf8"),
  ]);

  assert.match(athletes, /<PageBanner placementId="ATHLETES_TOP" \/>/);
  assert.match(runtime, /publicRead\(placementId\)/);
  assert.doesNotMatch(runtime, /setInterval|setTimeout/);
});
