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
  ["packages/frontend/src/athletes/AthletesPages.tsx", "ATHLETES_TOP"],
];

test("every canonical page-top placement has one PageBanner owner", async () => {
  for (const [path, placementId] of placements) {
    const source = await readFile(path, "utf8");
    assert.equal(
      (source.match(new RegExp('<PageBanner placementId=\\"' + placementId + '\\"', "g")) ?? [])
        .length,
      1,
      path + " must render exactly one " + placementId + " PageBanner",
    );
    assert.equal(
      source.includes('<PageBanner placementId="' + placementId + '" />'),
      false,
      path + " must not leave a self-closing PageBanner without its page-hero content",
    );
  }
});

test("the former page hero is not rendered as a sibling or fallback owner", async () => {
  const ride = await readFile("packages/frontend/src/rides/RideGatewayPage.tsx", "utf8");
  assert.doesNotMatch(ride, /RideHero|RidePageBannerFallback|ride-hero/);

  for (const path of [
    "packages/frontend/src/events/PlayPage.tsx",
    "packages/frontend/src/teams/TeamsPage.tsx",
    "packages/frontend/src/communities/HoomaPage.tsx",
  ]) {
    const page = await readFile(path, "utf8");
    assert.doesNotMatch(
      page,
      /<PageBanner placementId="[^"]+"\s*\/>[\s\S]*?(?:PlayHero|TeamsHero|hooma-hero)/,
    );
  }
});

test("Athletes page-top markup and CSS use the same PageBanner selector names", async () => {
  const [tsx, css] = await Promise.all([
    readFile("packages/frontend/src/athletes/AthletesPages.tsx", "utf8"),
    readFile("packages/frontend/src/athletes/athletes.css", "utf8"),
  ]);
  for (const token of [
    "page-banner--athletes",
    "page-banner--athletes__image",
    "page-banner--athletes__title",
    "page-banner--athletes__motion",
  ]) {
    assert.ok(tsx.includes(token), token + " must appear in Athletes markup");
    assert.ok(css.includes(token), token + " must appear in Athletes CSS");
  }
  assert.doesNotMatch(
    tsx,
    /athletes-hero--hub|athletes-hero__banner|athletes-hero__semantic-title/,
  );
});

test("PageBanner keeps the existing page-hero content in one surface", async () => {
  const runtime = await readFile("packages/frontend/src/page-banner/PageBanner.tsx", "utf8");
  assert.match(runtime, /children: \(state: PageBannerRenderState\) => ReactNode/);
  assert.match(runtime, /data-page-banner-surface/);
  assert.doesNotMatch(runtime, /PageBannerFallback|legacy hero/i);
});
