import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requestsPage = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
const ridesPage = await readFile("packages/frontend/src/rides/RidesPage.tsx", "utf8");
const rideGatewayPage = await readFile("packages/frontend/src/rides/RideGatewayPage.tsx", "utf8");
const rideOfferDetailPage = await readFile(
  "packages/frontend/src/rides/RideOfferDetailPage.tsx",
  "utf8",
);
const rideDestinationFields = await readFile(
  "packages/frontend/src/rides/RideDestinationFields.tsx",
  "utf8",
);
const rideApi = await readFile("packages/frontend/src/rides/api.ts", "utf8");
const rideCss = await readFile("packages/frontend/src/rides/rides.css", "utf8");

test("Requests shell owns page-local Requests and FundMe tabs without backend pretence", () => {
  assert.match(requestsPage, /export type RequestsPageTab = "requests" \| "fundme"/);
  assert.match(requestsPage, /href="\/requests"/);
  assert.match(requestsPage, /href="\/requests\/fundme"/);
  assert.match(requestsPage, /no donation form or payment intent/i);
  assert.doesNotMatch(requestsPage, /fetch\(/);
  assert.doesNotMatch(requestsPage, /create[A-Z][A-Za-z]*Api/);
  assert.doesNotMatch(requestsPage, /amount|card|checkout|invoice/i);
});

test("Ride surface uses real Ride APIs and no longer ships the old fake shell", () => {
  assert.match(ridesPage, /export \{ RideGatewayPage, RidesPage \}/);
  assert.match(
    rideGatewayPage,
    /const query = \{ limit: 3, \.\.\.\(context \? \{ context \} : \{\}\) \}/,
  );
  assert.match(rideGatewayPage, /api\.listOffers\(query\)/);
  assert.match(rideGatewayPage, /api\.listRequests\(query\)/);
  assert.match(rideGatewayPage, /RIDE OFFERS/);
  assert.match(rideGatewayPage, /RIDE REQUESTS/);
  assert.match(rideOfferDetailPage, /getMyParticipation/);
  assert.match(rideOfferDetailPage, /getMeetingPoint/);
  assert.match(rideOfferDetailPage, /Request participation/);
  assert.match(rideOfferDetailPage, /Private meeting point/);
  assert.match(rideDestinationFields, /publicPlay\(\)/);
  assert.match(rideDestinationFields, /publicWatch\(\)/);
  assert.match(rideDestinationFields, /placesApi\s*\.\s*list\(\)/);
  assert.match(rideDestinationFields, /destination\.type !== "EVENT"/);
  assert.match(rideDestinationFields, /destination\.type !== "PLACE"/);
  assert.doesNotMatch(
    rideDestinationFields,
    /Promise\.all\(\[eventApi\.publicPlay\(\), eventApi\.publicWatch\(\), placesApi\.list\(\)\]\)/,
  );
  assert.doesNotMatch(rideDestinationFields, /Event ID|Place ID/);
  assert.match(rideCss, /\.ride-hero__banner \{[\s\S]*object-fit:\s*cover/);
  assert.match(rideCss, /\.ride-recent-card__media img \{[\s\S]*object-fit:\s*contain/);
  assert.match(rideApi, /\/api\/public\/v1\/rides\/\$\{kind\}/);
  assert.match(rideApi, /listPath\("offers"/);
  assert.match(rideApi, /\/api\/v1\/rides/);
  assert.match(rideApi, /replaceOfferVehiclePhoto/);
  assert.match(rideApi, /requestParticipation/);
  assert.match(rideApi, /participations\/me/);
  assert.doesNotMatch(rideGatewayPage, /Rides to matches and events will become available/);
  assert.doesNotMatch(rideGatewayPage, /does not list drivers/);
  assert.doesNotMatch(rideOfferDetailPage, /create bookings/);
  assert.doesNotMatch(rideOfferDetailPage, /navigator\.geolocation/);
  assert.doesNotMatch(rideGatewayPage + rideOfferDetailPage, /fetch\(/);
  assert.doesNotMatch(
    rideGatewayPage + rideOfferDetailPage,
    /FundMe|payment intent|checkout|invoice/i,
  );
});
