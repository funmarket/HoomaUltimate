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

test("Ride create forms build explicit context compensation and audience contract input", () => {
  assert.match(offerCreatePage, /context:\s*rideContext/);
  assert.match(offerCreatePage, /compensationTerms:\s*buildRideOfferCompensationTerms/);
  assert.match(requestCreatePage, /context:\s*rideContext/);
  assert.match(requestCreatePage, /compensationTerms:\s*buildRideRequestCompensationTerms/);
  assert.match(requestCreatePage, /audience:\s*buildRideRequestAudience\(/);
  assert.match(requestCreatePage, /scope:\s*"GLOBAL"/);
  assert.match(requestCreatePage, /selection:\s*"ONE"/);
  assert.match(requestCreatePage, /selection:\s*"ALL_CURRENT"/);
  assert.doesNotMatch(requestCreatePage, /communityIds/);
  assert.doesNotMatch(offerCreatePage, /compensationTerms:\s*\{\s*type:\s*"FREE"\s*\}/);
  assert.doesNotMatch(requestCreatePage, /compensationTerms:\s*\{\s*type:\s*"FREE"\s*\}/);
});

test("Ride request Share With UI exposes exactly three audience choices and zero-community copy", () => {
  assert.match(requestCreatePage, />SHARE WITH</);
  assert.match(requestCreatePage, /Who should see this Ride request\?/);
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

test("Ride request success copy keeps one canonical request across audience choices", () => {
  assert.match(requestCreatePage, /Your Ride request is live in Ride\./);
  assert.match(requestCreatePage, /Your Ride request is live in HOOMA NOW for/);
  assert.match(requestCreatePage, /HOOMAs\./);
  assert.doesNotMatch(requestCreatePage, /requests created/i);
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
  assert.match(offerCreatePage, /href=\{`\/rides\/offers\/new\$\{contextQuery\(rideContext\)\}`\}/);
  assert.match(requestCreatePage, /href=\{`\/rides\$\{contextQuery\(rideContext\)\}`\}/);
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
  assert.doesNotMatch(moneyHelper, /CashCurrency \| string/);
  assert.doesNotMatch(moneyHelper, /: 2;/);
  assert.match(offerCard, /RideCompensationBadge/);
});
