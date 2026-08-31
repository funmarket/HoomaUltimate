import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requestsPage = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
const ridesPage = await readFile("packages/frontend/src/rides/RidesPage.tsx", "utf8");
const rideApi = await readFile("packages/frontend/src/rides/api.ts", "utf8");

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
  assert.match(ridesPage, /createRideApi\(transport\)/);
  assert.match(ridesPage, /TAKE ME TO THE GAME/);
  assert.match(ridesPage, /RIDE OFFERS/);
  assert.match(ridesPage, /Request participation/);
  assert.match(ridesPage, /Vehicle photo/);
  assert.match(ridesPage, /Private meeting point/);
  assert.match(ridesPage, /No fake matching, no fare collection/);
  assert.match(rideApi, /\/api\/public\/v1\/rides\/\$\{kind\}/);
  assert.match(rideApi, /listPath\("offers"/);
  assert.match(rideApi, /\/api\/v1\/rides/);
  assert.match(rideApi, /replaceOfferVehiclePhoto/);
  assert.match(rideApi, /requestParticipation/);
  assert.doesNotMatch(ridesPage, /Rides to matches and events will become available/);
  assert.doesNotMatch(ridesPage, /does not list drivers/);
  assert.doesNotMatch(ridesPage, /create bookings/);
  assert.doesNotMatch(ridesPage, /navigator\.geolocation/);
  assert.doesNotMatch(ridesPage, /fetch\(/);
  assert.doesNotMatch(ridesPage, /FundMe|payment intent|checkout|invoice/i);
});
