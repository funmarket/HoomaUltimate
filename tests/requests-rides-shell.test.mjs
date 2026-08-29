import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requestsPage = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
const ridesPage = await readFile("packages/frontend/src/rides/RidesPage.tsx", "utf8");

test("Requests shell owns page-local Requests and FundMe tabs without backend pretence", () => {
  assert.match(requestsPage, /export type RequestsPageTab = "requests" \| "fundme"/);
  assert.match(requestsPage, /href="\/requests"/);
  assert.match(requestsPage, /href="\/requests\/fundme"/);
  assert.match(requestsPage, /no donation form or payment intent/i);
  assert.doesNotMatch(requestsPage, /fetch\(/);
  assert.doesNotMatch(requestsPage, /create[A-Z][A-Za-z]*Api/);
  assert.doesNotMatch(requestsPage, /amount|card|checkout|invoice/i);
});

test("Rides shell is presentation-only and does not imply live location or booking", () => {
  assert.match(ridesPage, /No rides are available yet/);
  assert.match(ridesPage, /does not list drivers/);
  assert.match(ridesPage, /request location access/);
  assert.match(ridesPage, /create bookings/);
  assert.doesNotMatch(ridesPage, /navigator\.geolocation/);
  assert.doesNotMatch(ridesPage, /fetch\(/);
  assert.doesNotMatch(ridesPage, /create[A-Z][A-Za-z]*Api/);
});
