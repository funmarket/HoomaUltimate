import assert from "node:assert/strict";
import test from "node:test";
import {
  navigateWithPageBannerPrefetch,
  pageBannerPlacementForPath,
} from "../apps/web/src/app/shell/page-banner-navigation.ts";

const destinations = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Watch", href: "/watch" },
  { label: "HOOMA", href: "/hooma" },
  { label: "Athletes", href: "/athletes" },
] as const;

test("initial route preparation resolves all canonical PageBanner roots and the Telegram Home alias", () => {
  for (const [path, placement] of [
    ["/", "HOME_TOP"],
    ["/telegram", "HOME_TOP"],
    ["/play", "PLAY_TOP"],
    ["/watch", "WATCH_TOP"],
    ["/hooma", "HOOMA_TOP"],
    ["/athletes", "ATHLETES_TOP"],
    ["/teams", "TEAMS_TOP"],
    ["/pitch", "PITCH_TOP"],
    ["/places", "PLACES_TOP"],
    ["/requests", "REQUESTS_TOP"],
    ["/athletes/gear-up", "GEAR_UP_TOP"],
    ["/rides", "RIDE_TOP"],
  ] as const) {
    assert.equal(pageBannerPlacementForPath(path, destinations), placement, path);
  }
  assert.equal(pageBannerPlacementForPath("/unknown", destinations), null);
});

test("nested routes do not inherit a parent primary-navigation placement", () => {
  assert.equal(pageBannerPlacementForPath("/watch/featured", destinations), null);
  assert.equal(pageBannerPlacementForPath("/athletes/gear-up/", destinations), null);
  assert.equal(pageBannerPlacementForPath("/athletes/gear-up/shops/shop-1", destinations), null);
  assert.equal(
    pageBannerPlacementForPath("/athletes/gear-up/products/product-1", destinations),
    null,
  );
});

test("navigation starts the relevant prefetch before navigating and never awaits it", () => {
  const events: string[] = [];
  let resolvePrefetch!: () => void;
  const pending = new Promise<void>((resolve) => (resolvePrefetch = resolve));
  navigateWithPageBannerPrefetch(
    "/play",
    destinations,
    (placementId) => {
      events.push(`prefetch:${placementId}`);
      return pending;
    },
    (href) => events.push(`navigate:${href}`),
  );
  assert.deepEqual(events, ["prefetch:PLAY_TOP", "navigate:/play"]);
  resolvePrefetch();
});

test("Home Gateway routes prefetch their canonical PageBanner placement before SPA navigation", () => {
  const events: string[] = [];
  navigateWithPageBannerPrefetch(
    "/rides",
    destinations,
    (placementId) => {
      events.push(`prefetch:${placementId}`);
      return Promise.resolve();
    },
    (href) => events.push(`navigate:${href}`),
  );
  assert.deepEqual(events, ["prefetch:RIDE_TOP", "navigate:/rides"]);
});

test("prefetch failure does not prevent navigation", async () => {
  const events: string[] = [];
  navigateWithPageBannerPrefetch(
    "/",
    destinations,
    async () => {
      events.push("prefetch");
      throw new Error("offline");
    },
    (href) => events.push(`navigate:${href}`),
  );
  await Promise.resolve();
  assert.deepEqual(events, ["prefetch", "navigate:/"]);
});
