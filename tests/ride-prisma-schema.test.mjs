import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function section(sourceText, start, end) {
  const from = sourceText.indexOf(start);
  assert.notEqual(from, -1, `Missing section start: ${start}`);
  const to = end ? sourceText.indexOf(end, from) : sourceText.length;
  assert.ok(to === -1 || to > from, `Invalid section end: ${end}`);
  return sourceText.slice(from, to === -1 ? sourceText.length : to);
}

const schema = source("packages/database/prisma/schema.prisma");
const migration = source(
  "packages/database/prisma/migrations/20260830185000_ride_core_persistence/migration.sql",
);
const vehiclePhotoMigration = source(
  "packages/database/prisma/migrations/20260831010000_ride_offer_vehicle_photo/migration.sql",
);
const canonicalModel = source("docs/CANONICAL_MODEL.md");

test("Ride core persistence owns only the approved RIDE-002 tables", () => {
  for (const model of [
    "RideOffer",
    "RideRequest",
    "RideParticipation",
    "RideMeetingPoint",
    "RideOfferWaypoint",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }

  assert.doesNotMatch(schema, /model RideMatch\{/);
  assert.doesNotMatch(schema, /model Match\{/);
  assert.doesNotMatch(migration, /RideOfferVehiclePhoto|CREATE TABLE "Request"|RequestClaim/);
  assert.doesNotMatch(migration, /Fundraising|Payment|MediaAsset|Attachment|entityType|entityId/);
});

test("Ride vehicle-photo persistence is Ride-owned metadata only", () => {
  const photo = section(schema, "model RideOfferVehiclePhoto {", "model RideRequest {");

  assert.match(schema, /vehiclePhoto\s+RideOfferVehiclePhoto\?/);
  assert.match(photo, /rideOfferId\s+String\s+@unique/);
  assert.match(photo, /objectKey\s+String\s+@unique/);
  assert.match(photo, /contentType\s+String/);
  assert.match(photo, /sizeBytes\s+Int/);
  assert.doesNotMatch(photo, /\bBytes\b|base64|entityType|entityId|bucket|credential/i);

  assert.match(vehiclePhotoMigration, /CREATE TABLE "RideOfferVehiclePhoto"/);
  assert.match(vehiclePhotoMigration, /"objectKey" TEXT NOT NULL/);
  assert.match(vehiclePhotoMigration, /"contentType" TEXT NOT NULL/);
  assert.match(vehiclePhotoMigration, /"sizeBytes" INTEGER NOT NULL/);
  assert.match(vehiclePhotoMigration, /CHECK \("sizeBytes" > 0\)/);
  assert.doesNotMatch(
    vehiclePhotoMigration,
    /BYTEA|base64|MediaAsset|Attachment|entityType|entityId|bucket|credential/i,
  );
});

test("Ride destination and capacity invariants are enforced in the migration", () => {
  assert.match(migration, /CREATE TYPE "RideOfferStatus"/);
  assert.match(migration, /CREATE TYPE "RideRequestStatus"/);
  assert.match(migration, /CREATE TYPE "RideParticipationStatus"/);
  assert.match(
    migration,
    /CONSTRAINT "RideOffer_destination_strategy_check" CHECK \(num_nonnulls\("eventId", "destinationPlaceId", "customDestinationLabel"\) = 1\)/,
  );
  assert.match(
    migration,
    /CONSTRAINT "RideRequest_destination_strategy_check" CHECK \(num_nonnulls\("eventId", "destinationPlaceId", "customDestinationLabel"\) = 1\)/,
  );
  assert.match(
    migration,
    /CONSTRAINT "RideOffer_total_seats_positive_check" CHECK \("totalSeats" > 0\)/,
  );
  assert.match(
    migration,
    /CONSTRAINT "RideRequest_passenger_count_positive_check" CHECK \("passengerCount" > 0\)/,
  );
  assert.match(
    migration,
    /CONSTRAINT "RideParticipation_seat_count_positive_check" CHECK \("seatCount" > 0\)/,
  );
});

test("Ride schema is shaped for later matching without persisting a generic match identity", () => {
  const rideOffer = section(schema, "model RideOffer {", "model RideRequest {");
  const rideRequest = section(schema, "model RideRequest {", "model RideParticipation {");
  const waypoint = section(schema, "model RideOfferWaypoint {", "model WhistleMetadata {");

  assert.match(rideOffer, /eventId\s+String\?/);
  assert.match(rideOffer, /destinationPlaceId\s+String\?/);
  assert.match(rideOffer, /departureAt\s+DateTime/);
  assert.match(rideOffer, /totalSeats\s+Int/);
  assert.match(rideOffer, /@@index\(\[eventId, status, departureAt\]\)/);
  assert.match(rideOffer, /@@index\(\[destinationPlaceId, status, departureAt\]\)/);

  assert.match(rideRequest, /eventId\s+String\?/);
  assert.match(rideRequest, /destinationPlaceId\s+String\?/);
  assert.match(rideRequest, /desiredDepartureAt\s+DateTime/);
  assert.match(rideRequest, /passengerCount\s+Int/);
  assert.match(rideRequest, /@@index\(\[eventId, status, desiredDepartureAt\]\)/);

  assert.match(waypoint, /rideOfferId\s+String/);
  assert.match(waypoint, /sequence\s+Int/);
  assert.match(waypoint, /placeId\s+String\?/);
  assert.match(waypoint, /areaLabel\s+String/);

  assert.match(canonicalModel, /Ride waypoints are ordered `RideOfferWaypoint` records/);
  assert.match(canonicalModel, /RideOfferVehiclePhoto` is a single-purpose Ride-owned metadata/);
});
