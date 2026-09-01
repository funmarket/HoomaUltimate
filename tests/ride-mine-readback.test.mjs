import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [contracts, apiClient, minePage, routes, rideRepository, rideService] = await Promise.all([
  readFile("packages/contracts/src/rides.ts", "utf8"),
  readFile("packages/frontend/src/rides/api.ts", "utf8"),
  readFile("packages/frontend/src/rides/RideMinePage.tsx", "utf8"),
  readFile("apps/api/src/modules/rides/http/ride.routes.ts", "utf8"),
  readFile("apps/api/src/modules/rides/infrastructure/prisma-ride.repository.ts", "utf8"),
  readFile("apps/api/src/modules/rides/application/ride.service.ts", "utf8"),
]);

test("Ride My Rides has a bounded authenticated server contract", () => {
  assert.match(contracts, /rideMineQuerySchema/);
  assert.match(
    contracts,
    /limit: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(50\)\.default\(20\)/,
  );
  assert.match(contracts, /offerCursor/);
  assert.match(contracts, /requestCursor/);
  assert.match(contracts, /participationCursor/);
  assert.match(contracts, /rideMineSchema = z\.object\(\{/);
  assert.match(contracts, /rideMineOfferSchema = publicRideOfferSchema\.extend\(\{/);
  assert.match(contracts, /participationCount: z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(contracts, /offers: rideMineOfferListSchema/);
  assert.match(contracts, /requests: rideRequestForOwnerListSchema/);
  assert.match(contracts, /participations: rideParticipationForPassengerListSchema/);
});

test("Ride My Rides member route derives actor identity from auth", () => {
  assert.match(routes, /router\.get\(\s*"\/mine"/);
  assert.match(routes, /service\.getMyRides\(getAuth\(request\)\.userId/);
  assert.doesNotMatch(
    routes,
    /driverUserId.*request\.body|requesterUserId.*request\.body|passengerUserId.*request\.body/,
  );
});

test("Ride My Rides repository queries stay Ride-owned and indexed actor fields", () => {
  assert.match(rideRepository, /listForDriver\(\s*driverUserId/);
  assert.match(rideRepository, /where: \{ driverUserId \}/);
  assert.match(rideRepository, /listForRequester\(\s*requesterUserId/);
  assert.match(rideRepository, /where: \{ requesterUserId \}/);
  assert.match(rideRepository, /listForPassenger\(\s*passengerUserId/);
  assert.match(rideRepository, /where: \{ passengerUserId \}/);
  assert.match(rideRepository, /rideOffer: \{ select: publicRideOfferSelect \}/);
  assert.doesNotMatch(
    rideRepository,
    /db\.user\.|tx\.user\.|db\.userPresentation\.|tx\.userPresentation\./,
  );
  const passengerSelect = rideRepository.slice(
    rideRepository.indexOf("const rideParticipationWithOfferSelect"),
    rideRepository.indexOf("const rideMeetingPointSelect"),
  );
  assert.doesNotMatch(passengerSelect, /meetingPoint|latitude|longitude/);
});

test("Ride My Rides offer summaries stay nested-bounded", () => {
  const listForDriverMethod = rideRepository.slice(
    rideRepository.indexOf("async listForDriver"),
    rideRepository.indexOf("async getPublic"),
  );
  assert.match(listForDriverMethod, /select: mineRideOfferSelect/);
  const mineOfferSelect = rideRepository.slice(
    rideRepository.indexOf("const mineRideOfferSelect"),
    rideRepository.indexOf("const ownerRideOfferSelect"),
  );
  assert.match(mineOfferSelect, /_count: \{ select: \{ participations: true \} \}/);
  assert.doesNotMatch(listForDriverMethod, /select: ownerRideOfferSelect/);
  assert.doesNotMatch(listForDriverMethod, /\.participations\.length/);
  assert.match(rideRepository, /participationCount: row\._count\.participations/);
  const mineOfferSchema = contracts.slice(
    contracts.indexOf("rideMineOfferSchema"),
    contracts.indexOf("rideMineOfferListSchema"),
  );
  assert.doesNotMatch(mineOfferSchema, /participations:/);
  assert.doesNotMatch(mineOfferSchema, /passengerUserId/);
  assert.doesNotMatch(minePage, /offer\.participations/);
  assert.match(minePage, /offer\.participationCount/);
});

test("Ride service composes My Rides without browser memory or meeting point aggregate", () => {
  assert.match(rideService, /getMyRides\(actorUserId/);
  assert.match(rideService, /offers\.listForDriver\(actorUserId/);
  assert.match(rideService, /requests\.listForRequester\(actorUserId/);
  assert.match(rideService, /participations\.listForPassenger\(actorUserId/);
  const mineMethod = rideService.slice(
    rideService.indexOf("async getMyRides"),
    rideService.indexOf("async replaceOfferVehiclePhoto"),
  );
  assert.doesNotMatch(mineMethod, /meetingPoints|getForAuthorizedViewer/);
  assert.doesNotMatch(mineMethod, /userPresentations|findByUserIds/);
});

test("Ride Mine UI reconstructs from API readback and never persists Ride IDs locally", () => {
  assert.match(apiClient, /getMyRides/);
  assert.match(apiClient, /\/mine\?/);
  assert.match(minePage, /api\s*\.getMyRides\(\{ limit: 20 \}\)/);
  assert.match(minePage, /MY RIDES/);
  assert.match(minePage, /My Offers/);
  assert.match(minePage, /My Requests/);
  assert.match(minePage, /My Trips \/ Participations/);
  assert.match(minePage, /RideCompensationBadge/);
  assert.match(minePage, /rideContextLabel\(participation\.offer\.context\)/);
  assert.doesNotMatch(minePage + apiClient, /localStorage|sessionStorage/);
  assert.doesNotMatch(minePage, /meetingPoint|latitude|longitude|Secret Gate/);
});
