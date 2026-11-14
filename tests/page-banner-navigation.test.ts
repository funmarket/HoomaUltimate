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

test("initial route preparation resolves exact primary navigation roots", () => {
  assert.equal(pageBannerPlacementForPath("/", destinations), "HOME_TOP");
  assert.equal(pageBannerPlacementForPath("/watch", destinations), "WATCH_TOP");
  assert.equal(pageBannerPlacementForPath("/athletes", destinations), "ATHLETES_TOP");
  assert.equal(pageBannerPlacementForPath("/telegram", destinations), null);
  assert.equal(pageBannerPlacementForPath("/unknown", destinations), null);
});

test("nested routes do not inherit a parent primary-navigation placement", () => {
  assert.equal(pageBannerPlacementForPath("/watch/featured", destinations), null);
  assert.equal(pageBannerPlacementForPath("/athletes/gear-up", destinations), null);
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
