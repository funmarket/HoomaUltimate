import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const offerCreatePage = await readFile(
  "packages/frontend/src/rides/RideOfferCreatePage.tsx",
  "utf8",
);
const requestCreatePage = await readFile(
  "packages/frontend/src/rides/RideRequestCreatePage.tsx",
  "utf8",
);
const compensationFields = await readFile(
  "packages/frontend/src/rides/RideCompensationFields.tsx",
  "utf8",
);
const destinationFields = await readFile(
  "packages/frontend/src/rides/RideDestinationFields.tsx",
  "utf8",
);
const gatewayPage = await readFile("packages/frontend/src/rides/RideGatewayPage.tsx", "utf8");
const offersPage = await readFile("packages/frontend/src/rides/RideOffersPage.tsx", "utf8");
const offerCard = await readFile("packages/frontend/src/rides/RideOfferCard.tsx", "utf8");
const moneyHelper = await readFile("packages/frontend/src/rides/ride-money.ts", "utf8");
const contextSelector = await readFile(
  "packages/frontend/src/rides/RideContextSelector.tsx",
  "utf8",
);
const rideApi = await readFile("packages/frontend/src/rides/api.ts", "utf8");
const rideMinePage = await readFile("packages/frontend/src/rides/RideMinePage.tsx", "utf8");
const ridesCss = await readFile("packages/frontend/src/rides/rides.css", "utf8");
const rideMobileCss = await readFile("packages/frontend/src/rides/rides-mobile.css", "utf8");
const webRouter = await readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8");

test("Ride create forms build explicit context compensation and audience contract input", () => {
  assert.match(offerCreatePage, /context:\s*rideContext/);
  assert.match(offerCreatePage, /compensationTerms:\s*buildRideOfferCompensationTerms/);
  assert.match(requestCreatePage, /context:\s*rideContext/);
  assert.match(requestCreatePage, /compensationTerms:\s*buildRideRequestCompensationTerms/);
  assert.match(requestCreatePage, /buildRideRequestAudience\(/);
  assert.match(requestCreatePage, /scope:\s*"GLOBAL"/);
  assert.match(requestCreatePage, /selection:\s*"ONE"/);
  assert.match(requestCreatePage, /selection:\s*"ALL_CURRENT"/);
  assert.doesNotMatch(requestCreatePage, /communityIds/);
  assert.doesNotMatch(offerCreatePage, /compensationTerms:\s*\{\s*type:\s*"FREE"\s*\}/);
  assert.doesNotMatch(requestCreatePage, /compensationTerms:\s*\{\s*type:\s*"FREE"\s*\}/);
});

test("Ride request Share With UI exposes exactly three audience choices and one visible question", () => {
  assert.match(requestCreatePage, />SHARE WITH</);
  assert.equal((requestCreatePage.match(/Who should see this Ride request\?/g) ?? []).length, 1);
  assert.match(requestCreatePage, />Everyone</);
  assert.match(requestCreatePage, /Visible in normal Ride request discovery\./);
  assert.match(requestCreatePage, />One of my HOOMAs</);
  assert.match(requestCreatePage, /Only members of the HOOMA you choose can see it\./);
  assert.match(requestCreatePage, />All my HOOMAs</);
  assert.match(requestCreatePage, /Share with every HOOMA where you are currently a member\./);
  assert.match(
    requestCreatePage,
    /Join or create a HOOMA to share this Ride request with a community\./,
  );
});

test("Ride audience selector is phone-first in authoritative Ride CSS and expands only on wider screens", () => {
  assert.match(ridesCss, /\.ride-audience-choice\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(ridesCss, /@media \(min-width: 721px\)/);
  assert.match(ridesCss, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(ridesCss, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(
    rideMobileCss,
    /grid-template-columns:\s*repeat\(3|grid-template-columns:\s*1fr/,
  );
  assert.doesNotMatch(`${ridesCss}\n${rideMobileCss}`, /!important/);
});

test("Ride request success copy keeps one canonical request across audience choices", () => {
  assert.match(requestCreatePage, /Your Ride request is live/);
  assert.match(requestCreatePage, /HOOMA NOW for/);
  assert.match(requestCreatePage, /HOOMAs\./);
  assert.doesNotMatch(requestCreatePage, /requests created/i);
});

test("Ride owners can edit the same Offer and Request from My Rides", () => {
  assert.match(rideMinePage, /My Offers/);
  assert.match(rideMinePage, /\/rides\/offers\/\$\{offer\.id\}\/edit/);
  assert.match(rideMinePage, /My Requests/);
  assert.match(rideMinePage, /\/rides\/requests\/\$\{request\.id\}\/edit/);
  assert.match(rideApi, /updateOffer:/);
  assert.match(rideApi, /method:\s*"PATCH"/);
  assert.match(rideApi, /updateRequest:/);
  assert.match(offerCreatePage, /\.manageOffer\(offerId\)/);
  assert.match(offerCreatePage, /api\.updateOffer\(offerId/);
  assert.match(requestCreatePage, /\.manageRequest\(requestId\)/);
  assert.match(requestCreatePage, /api\.updateRequest\(requestId/);
  assert.match(webRouter, /\/rides\/offers\/:offerId\/edit/);
  assert.match(webRouter, /\/rides\/requests\/:requestId\/edit/);
});

test("Ride request edit preserves saved Community audience unless the owner changes it", () => {
  assert.match(requestCreatePage, /audienceDirty/);
  assert.match(requestCreatePage, /editing && !audienceDirty/);
  assert.match(requestCreatePage, /\.\.\.\(audienceDirty/);
});

test("Ride compensation fields are shared, mode-aware, and prevent stale cash submission", () => {
  assert.match(compensationFields, /mode:\s*"offer" \| "request"/);
  assert.match(compensationFields, /Free ride/);
  assert.match(compensationFields, /Charge cash/);
  assert.match(compensationFields, /No cash offer/);
  assert.match(compensationFields, /Offer cash/);
  assert.match(compensationFields, /PER_SEAT/);
  assert.match(compensationFields, /TOTAL/);
  assert.match(compensationFields, /return \{ type: "FREE" \}/);
  assert.match(compensationFields, /amountToMinorUnits/);
  assert.match(compensationFields, /compensationFormStateFromTerms/);
  assert.doesNotMatch(compensationFields, /parseFloat|Math\.round\(.*\*|Number\(amount/);
});

test("Ride context journey is explicit and generic routes expose a selector", () => {
  assert.match(gatewayPage, /contextQuery\(copy\.context\)/);
  assert.match(gatewayPage, /href=\{`\/rides\/request\$\{scopedQuery\}`\}/);
  assert.match(gatewayPage, /href=\{`\/rides\/offers\/new\$\{scopedQuery\}`\}/);
  assert.match(gatewayPage, /href=\{`\/rides\/offers\$\{scopedQuery\}`\}/);
  assert.match(gatewayPage, /actionHref=\{`\/rides\/offers\$\{scopedQuery\}`\}/);
  assert.match(offerCreatePage, /RideContextSelector/);
  assert.match(requestCreatePage, /RideContextSelector/);
  assert.match(
    contextSelector,
    /return value === "GENERAL" \|\| value === "MATCHDAY" \? value : undefined/,
  );
  assert.match(contextSelector, /return rideContextFromQuery\(\) \?\? "MATCHDAY"/);
  assert.match(offerCreatePage, /initialRideContext\(\)/);
  assert.match(requestCreatePage, /initialRideContext\(\)/);
  assert.match(offerCreatePage, /\/rides\/offers/);
  assert.match(requestCreatePage, /\/rides/);
});

test("Ride offer list reads explicit context query while generic offers stay unfiltered", () => {
  assert.match(contextSelector, /rideContextFromQuery/);
  assert.match(offersPage, /const rideContext = rideContextFromQuery\(\)/);
  assert.match(
    offersPage,
    /listOffers\(\{ limit: 30, \.\.\.\(rideContext \? \{ context: rideContext \} : \{\}\) \}\)/,
  );
  assert.match(offersPage, /actionHref=\{`\/rides\/offers\/new\$\{scopedQuery\}`\}/);
});

test("GENERAL Ride destination hides Event while MATCHDAY can use Event Place Custom", () => {
  assert.match(destinationFields, /context\?: RideContext/);
  assert.match(destinationFields, /const eventDestinationEnabled = context !== "GENERAL"/);
  assert.match(destinationFields, /eventDestinationEnabled \? \(/);
  assert.match(destinationFields, /destination\.type === "EVENT" && !eventDestinationEnabled/);
});

test("Ride compensation presentation uses deterministic currency exponents", () => {
  assert.match(moneyHelper, /SUPPORTED_CASH_CURRENCIES/);
  assert.match(moneyHelper, /currencyMinorUnitExponent/);
  assert.match(moneyHelper, /amountToMinorUnits/);
  assert.match(moneyHelper, /minorUnitsToAmountLabel/);
  assert.match(moneyHelper, /minorUnitsToAmountInput/);
  assert.doesNotMatch(moneyHelper, /CashCurrency \| string/);
  assert.doesNotMatch(moneyHelper, /: 2;/);
  assert.match(offerCard, /RideCompensationBadge/);
});
