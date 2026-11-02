import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const placements = [
  {
    path: "apps/web/src/home/HomePage.tsx",
    placementId: "HOME_TOP",
    forbidden: ["<HomeHero"],
  },
  {
    path: "packages/frontend/src/events/PlayPage.tsx",
    placementId: "PLAY_TOP",
    forbidden: ["<PlayHero", "play-hero-pro"],
  },
  {
    path: "packages/frontend/src/watch/WatchPage.tsx",
    placementId: "WATCH_TOP",
    forbidden: ["watch-hero"],
  },
  {
    path: "packages/frontend/src/communities/HoomaPage.tsx",
    placementId: "HOOMA_TOP",
    forbidden: ["hooma-hero panel"],
  },
  {
    path: "packages/frontend/src/teams/TeamsPage.tsx",
    placementId: "TEAMS_TOP",
    forbidden: ["<TeamsHero", "teams-hero-pro"],
  },
  {
    path: "packages/frontend/src/pitch/PitchPage.tsx",
    placementId: "PITCH_TOP",
    forbidden: ["pitch-discovery-hero"],
  },
  {
    path: "packages/frontend/src/places/PlacesPages.tsx",
    placementId: "PLACES_TOP",
    forbidden: [],
  },
  {
    path: "packages/frontend/src/requests/RequestsPage.tsx",
    placementId: "REQUESTS_TOP",
    forbidden: ["help-hero"],
  },
  {
    path: "packages/frontend/src/gear-up/GearUpPage.tsx",
    placementId: "GEAR_UP_TOP",
    forbidden: ["gear-up-hero"],
  },
  {
    path: "packages/frontend/src/rides/RideGatewayPage.tsx",
    placementId: "RIDE_TOP",
    forbidden: ["RideHero", "ride-hero"],
  },
  {
    path: "packages/frontend/src/athletes/AthletesPages.tsx",
    placementId: "ATHLETES_TOP",
    forbidden: ["athletes-hero--hub", "athletes-hero__banner"],
  },
];

test("all canonical public roots have exactly one PageBanner page-top owner", () => {
  for (const { path, placementId, forbidden } of placements) {
    const source = readFileSync(path, "utf8");

    assert.equal(
      source.split("<PageBanner").length - 1,
      1,
      `${path} must render exactly one PageBanner`,
    );
    assert.ok(source.includes(`placementId="${placementId}"`), `${path} must own ${placementId}`);
    assert.equal(
      source.includes("/api/public/v1/banners"),
      false,
      `${path} must use the shared PageBanner API seam`,
    );

    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${path} must not retain ${token}`);
    }
  }
});

test("Ride keeps its exact actions inside the single RIDE_TOP PageBanner", () => {
  const source = readFileSync("packages/frontend/src/rides/RideGatewayPage.tsx", "utf8");

  assert.ok(source.includes("page-banner__actions--ride"));
  assert.ok(source.includes("Request a Ride"));
  assert.ok(source.includes("Browse Offers"));
  assert.ok(source.includes("Offer Seats"));
  assert.ok(source.includes("href={`/rides/request${scopedQuery}`}"));
  assert.ok(source.includes("href={`/rides/offers${scopedQuery}`}"));
  assert.ok(source.includes("href={`/rides/offers/new${scopedQuery}`}"));
});

test("Athletes hub JSX and CSS use the same canonical PageBanner selector vocabulary", () => {
  const page = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
  const css = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
  const selectors = [
    "page-banner__fallback--athletes",
    "page-banner__fallback-image--athletes",
    "page-banner__semantic-title--athletes",
    "page-banner__motion--athletes",
  ];

  for (const selector of selectors) {
    assert.ok(page.includes(selector), `Athletes JSX must use ${selector}`);
    assert.ok(css.includes(`.${selector}`), `Athletes CSS must style ${selector}`);
  }

  assert.equal(page.includes("athletes-hero--hub"), false);
  assert.equal(css.includes("athletes-hero--hub"), false);
});

test("superseded Home, Play and Teams hero modules and exports are removed", () => {
  const uiIndex = readFileSync("packages/ui/src/index.tsx", "utf8");

  for (const name of ["HomeHero", "PlayHero", "TeamsHero"]) {
    assert.equal(uiIndex.includes(name), false, `@hooma/ui must not export ${name}`);
  }

  assert.equal(existsSync("packages/ui/src/home/HomeHero.tsx"), false);
  assert.equal(existsSync("packages/ui/src/play/PlayHero.tsx"), false);
  assert.equal(existsSync("packages/ui/src/teams/TeamsHero.tsx"), false);
});

test("PageBanner runtime retains shared public reads without auto-rotation", () => {
  const runtime = readFileSync("packages/frontend/src/page-banner/PageBanner.tsx", "utf8");

  assert.ok(runtime.includes("publicRead(placementId)"));
  assert.equal(runtime.includes("setInterval"), false);
  assert.equal(runtime.includes("setTimeout"), false);
});
