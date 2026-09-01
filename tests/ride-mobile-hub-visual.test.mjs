import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const rideSources = () =>
  [
    "packages/frontend/src/rides/RideGatewayPage.tsx",
    "packages/frontend/src/rides/RideFeatureGrid.tsx",
    "packages/frontend/src/rides/RideCompensationBadge.tsx",
    "packages/frontend/src/rides/RideIcons.tsx",
  ]
    .map(source)
    .join("\n");

function cssRule(css, selector) {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const bodyEnd = css.indexOf("\n}", bodyStart);
  return bodyEnd < 0 ? "" : css.slice(bodyStart, bodyEnd);
}

test("Ride hub uses the locked exact ON MY WAY banner image", () => {
  const gateway = source("packages/frontend/src/rides/RideGatewayPage.tsx");
  const css = source("packages/frontend/src/rides/rides.css");

  assert.match(gateway, /ON MY WAY/);
  assert.match(gateway, /Going somewhere solo\? Why\?/);
  assert.match(gateway, /See who's on your route/);
  assert.match(gateway, /Where you meet stays between you\./);
  assert.match(gateway, /src="\/rides\/on-my-way-banner\.png"/);
  assert.match(gateway, /ride-hero__sr-copy/);

  const hero = cssRule(css, ".ride-hero");
  assert.match(hero, /padding:\s*0/);
  const media = cssRule(css, ".ride-hero__media");
  assert.match(media, /overflow:\s*hidden/);
  assert.match(media, /aspect-ratio:\s*1672 \/ 941/);
  assert.match(media, /border-radius:\s*28px 28px 0 0/);
  const banner = cssRule(css, ".ride-hero__banner");
  assert.match(banner, /width:\s*100%/);
  assert.match(banner, /height:\s*100%/);
  assert.match(banner, /object-fit:\s*cover/);
  assert.match(banner, /object-position:\s*center/);

  assert.match(css, /--ride-gold:\s*var\(--app-gold\)/);
  assert.match(css, /--ride-sky-silver:\s*#afcfe6/);
  assert.match(css, /--ride-lime:\s*var\(--app-lime\)/);
  assert.match(css, /--ride-text-strong:\s*var\(--app-text-strong\)/);
  assert.doesNotMatch(css, /\.ride-hero__route/);
  assert.doesNotMatch(css, /color:\s*var\(--ride-gold\) !important/);
});

test("Ride hero actions keep approved IA and phone-first button layout", () => {
  const gateway = source("packages/frontend/src/rides/RideGatewayPage.tsx");
  const css = source("packages/frontend/src/rides/rides.css");
  const webMain = source("apps/web/src/main.tsx");
  const webPackage = source("apps/web/package.json");

  assert.match(gateway, /Request a Ride/);
  assert.match(gateway, /Browse Offers/);
  assert.match(gateway, /Offer Seats/);
  assert.doesNotMatch(gateway, /Find a seat|See seats|I've got a seat/);
  assert.match(gateway, /RideMapPinIcon/);
  assert.match(gateway, /RideBrowseIcon/);
  assert.match(gateway, /RideCarPlusIcon/);
  assert.match(gateway, /RideLockIcon/);
  const icons = source("packages/frontend/src/rides/RideIcons.tsx");
  assert.match(icons, /requestAction: "\/rides\/icons\/request-action\.png"/);
  assert.match(icons, /browseOffers: "\/rides\/icons\/browse-offers\.png"/);
  assert.match(icons, /offerSeats: "\/rides\/icons\/offer-seats\.png"/);
  assert.match(icons, /privacy: "\/rides\/icons\/privacy-lock\.png"/);
  assert.match(icons, /RIDE_EXACT_ICON_ASSETS/);
  assert.match(icons, /<img alt="" aria-hidden="true"/);
  assert.doesNotMatch(gateway, /⌖|●●●|🔒/);

  const actions = cssRule(css, ".ride-hero__actions");
  assert.match(actions, /grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /\.ride-hero__actions \.ride-button--primary/);
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /\.ride-button img/);
  const button = cssRule(css, ".ride-button");
  assert.match(webMain, /@fontsource\/pridi\/500\.css/);
  assert.match(webMain, /@fontsource\/pridi\/600\.css/);
  assert.match(webPackage, /"@fontsource\/pridi"/);
  assert.match(button, /font-family:\s*var\(--ride-pridi\)/);
  assert.match(button, /font-weight:\s*600/);
  assert.doesNotMatch(button, /font-weight:\s*850/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /background:\s*var\(--app-accent\);\s*\n\s*color:\s*#111/);
});

test("Ride hub has the required four distinctive feature cards and compact real-data sections", () => {
  const gateway = rideSources();
  const css = source("packages/frontend/src/rides/rides.css");

  for (const label of ["MATCHDAY RIDE", "ANYWHERE RIDE", "REQUEST A RIDE", "MY RIDES"]) {
    assert.match(gateway, new RegExp(label));
  }
  assert.match(gateway, /Head to the match together\./);
  assert.match(gateway, /Airport, work, home or another city\./);
  assert.match(gateway, /Need a lift\? Post your trip\./);
  assert.match(gateway, /Your offers, requests and Ride status\./);
  assert.match(gateway, /href: "\/rides\/request\?context=MATCHDAY"/);
  assert.match(gateway, /href: "\/rides\/request\?context=GENERAL"/);
  assert.doesNotMatch(gateway, /href: "\/rides\/matchday"/);
  assert.doesNotMatch(gateway, /href: "\/rides\/anywhere"/);
  assert.match(gateway, /href: "\/rides\/mine"/);
  assert.match(gateway, /RideStadiumIcon/);
  assert.match(gateway, /RideRouteIcon/);
  assert.match(gateway, /RideMapPinPlusIcon/);
  assert.match(gateway, /RideHistoryIcon/);
  assert.match(gateway, /matchday: "\/rides\/icons\/matchday-ride\.png"/);
  assert.match(gateway, /anywhere: "\/rides\/icons\/anywhere-ride\.png"/);
  assert.match(gateway, /requestFeature: "\/rides\/icons\/request-ride\.png"/);
  assert.match(gateway, /myRides: "\/rides\/icons\/my-rides\.png"/);
  assert.doesNotMatch(gateway, /⌂|▰|🔒/);
  assert.match(gateway, /RideCompensationBadge/);
  assert.match(gateway, /photoUrl\(offer\.id\)/);
  assert.match(gateway, /Ride activity unavailable\. Try again shortly\./);
  assert.match(gateway, /No public Ride offers are available yet\./);
  assert.match(gateway, /No public Ride requests yet\./);

  const grid = cssRule(css, ".ride-feature-grid");
  const featureTitle = cssRule(css, ".ride-feature-card__title");
  const featureCopy = cssRule(css, ".ride-feature-card__copy");
  assert.match(grid, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(featureTitle, /color:\s*var\(--ride-lime\)/);
  assert.doesNotMatch(featureCopy, /color:\s*var\(--ride-lime\)/);
  assert.match(cssRule(css, ".ride-link"), /color:\s*var\(--ride-sky-silver\)/);
  assert.doesNotMatch(cssRule(css, ".ride-link"), /color:\s*var\(--ride-gold\)/);
  assert.match(css, /\.ride-empty-state \{[\s\S]*padding:\s*8px 10px/);
  assert.match(css, /\.ride-feature-card::after/);
  assert.doesNotMatch(css, /radial-gradient\(circle at 78% 20%/);
});
