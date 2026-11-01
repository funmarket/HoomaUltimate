import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_BANNER_MAX_SLIDES,
  PAGE_BANNER_PLACEMENT_IDS,
  pageBannerDestinationSchema,
  pageBannerSlideMetadataSchema,
} from "@hooma/contracts/page-banner";

test("PageBanner contracts expose the approved page placements and slide limit", () => {
  assert.deepEqual(PAGE_BANNER_PLACEMENT_IDS, [
    "HOME_TOP",
    "PLAY_TOP",
    "WATCH_TOP",
    "HOOMA_TOP",
    "TEAMS_TOP",
    "PITCH_TOP",
    "PLACES_TOP",
    "REQUESTS_TOP",
    "GEAR_UP_TOP",
    "RIDE_TOP",
    "ATHLETES_TOP",
  ]);
  assert.equal(PAGE_BANNER_MAX_SLIDES, 3);
});

test("PageBanner metadata requires alt text for informational artwork and allows decorative artwork without it", () => {
  assert.equal(pageBannerSlideMetadataSchema.parse({ isDecorative: true }).altText, undefined);
  assert.throws(() => pageBannerSlideMetadataSchema.parse({ isDecorative: false }));
  assert.throws(() =>
    pageBannerSlideMetadataSchema.parse({ isDecorative: true, altText: "Decorative" }),
  );
});

test("PageBanner destinations allow internal and external targets but reject unsafe external URLs", () => {
  assert.equal(
    pageBannerDestinationSchema.parse({ kind: "INTERNAL", url: "/places/one" }).kind,
    "INTERNAL",
  );
  assert.equal(
    pageBannerDestinationSchema.parse({ kind: "EXTERNAL", url: "https://example.com/page" }).url,
    "https://example.com/page",
  );
  assert.throws(() =>
    pageBannerDestinationSchema.parse({ kind: "EXTERNAL", url: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    pageBannerDestinationSchema.parse({ kind: "EXTERNAL", url: "https://user:pass@example.com" }),
  );
});
