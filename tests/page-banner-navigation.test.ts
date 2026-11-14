import assert from "node:assert/strict";
import test from "node:test";
import {
  navigateWithPageBannerPrefetch,
  pageBannerPlacementForExactPrimaryPath,
  pageBannerPlacementForPath,
} from "../apps/web/src/app/shell/page-banner-navigation.ts";

const destinations = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Watch", href: "/watch" },
  { label: "HOOMA", href: "/hooma" },
  { label: "Athletes", href: "/athletes" },
] as const;

test("initial route preparation resolves only its known canonical placement", () => {
  assert.equal(pageBannerPlacementForPath("/", destinations), "HOME_TOP");
  assert.equal(pageBannerPlacementForPath("/watch/featured", destinations), "WATCH_TOP");
  assert.equal(pageBannerPlacementForPath("/telegram", destinations), null);
  assert.equal(pageBannerPlacementForPath("/unknown", destinations), null);
});

test("early session preparation uses only exact primary page roots", () => {
  assert.equal(pageBannerPlacementForExactPrimaryPath("/", destinations), "HOME_TOP");
  assert.equal(pageBannerPlacementForExactPrimaryPath("/play", destinations), "PLAY_TOP");
  assert.equal(pageBannerPlacementForExactPrimaryPath("/athletes/gear-up", destinations), null);
  assert.equal(pageBannerPlacementForExactPrimaryPath("/teams", destinations), null);
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
