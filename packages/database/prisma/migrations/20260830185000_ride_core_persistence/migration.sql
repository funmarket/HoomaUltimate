CREATE TYPE "RideOfferStatus" AS ENUM ('OPEN', 'FULL', 'DEPARTED', 'CANCELLED', 'COMPLETED');

CREATE TYPE "RideRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CANCELLED', 'EXPIRED', 'COMPLETED');

CREATE TYPE "RideParticipationStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "RideOffer" (
    "id" TEXT NOT NULL,
    "driverUserId" TEXT NOT NULL,
    "eventId" TEXT,
    "destinationPlaceId" TEXT,
    "customDestinationLabel" TEXT,
    "originAreaLabel" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehicleColor" TEXT,
    "note" TEXT,
    "status" "RideOfferStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideOffer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideOffer_destination_strategy_check" CHECK (num_nonnulls("eventId", "destinationPlaceId", "customDestinationLabel") = 1),
    CONSTRAINT "RideOffer_custom_destination_label_not_blank_check" CHECK ("customDestinationLabel" IS NULL OR length(btrim("customDestinationLabel")) > 0),
    CONSTRAINT "RideOffer_total_seats_positive_check" CHECK ("totalSeats" > 0)
);

CREATE TABLE "RideRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "eventId" TEXT,
    "destinationPlaceId" TEXT,
    "customDestinationLabel" TEXT,
    "pickupAreaLabel" TEXT NOT NULL,
    "desiredDepartureAt" TIMESTAMP(3) NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "RideRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideRequest_destination_strategy_check" CHECK (num_nonnulls("eventId", "destinationPlaceId", "customDestinationLabel") = 1),
    CONSTRAINT "RideRequest_custom_destination_label_not_blank_check" CHECK ("customDestinationLabel" IS NULL OR length(btrim("customDestinationLabel")) > 0),
    CONSTRAINT "RideRequest_passenger_count_positive_check" CHECK ("passengerCount" > 0)
);

CREATE TABLE "RideParticipation" (
    "id" TEXT NOT NULL,
    "rideOfferId" TEXT NOT NULL,
    "passengerUserId" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "status" "RideParticipationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RideParticipation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideParticipation_seat_count_positive_check" CHECK ("seatCount" > 0)
);

CREATE TABLE "RideMeetingPoint" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideMeetingPoint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideMeetingPoint_latitude_range_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
    CONSTRAINT "RideMeetingPoint_longitude_range_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180))
);

CREATE TABLE "RideOfferWaypoint" (
    "id" TEXT NOT NULL,
    "rideOfferId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "placeId" TEXT,
    "areaLabel" TEXT NOT NULL,

    CONSTRAINT "RideOfferWaypoint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideOfferWaypoint_sequence_nonnegative_check" CHECK ("sequence" >= 0)
);

CREATE INDEX "RideOffer_status_departureAt_id_idx"
ON "RideOffer"("status", "departureAt", "id");

CREATE INDEX "RideOffer_driverUserId_status_departureAt_idx"
ON "RideOffer"("driverUserId", "status", "departureAt");

CREATE INDEX "RideOffer_eventId_status_departureAt_idx"
ON "RideOffer"("eventId", "status", "departureAt");

CREATE INDEX "RideOffer_destinationPlaceId_status_departureAt_idx"
ON "RideOffer"("destinationPlaceId", "status", "departureAt");

CREATE INDEX "RideRequest_status_desiredDepartureAt_id_idx"
ON "RideRequest"("status", "desiredDepartureAt", "id");

CREATE INDEX "RideRequest_requesterUserId_status_createdAt_idx"
ON "RideRequest"("requesterUserId", "status", "createdAt");

CREATE INDEX "RideRequest_eventId_status_desiredDepartureAt_idx"
ON "RideRequest"("eventId", "status", "desiredDepartureAt");

CREATE INDEX "RideRequest_destinationPlaceId_status_desiredDepartureAt_idx"
ON "RideRequest"("destinationPlaceId", "status", "desiredDepartureAt");

CREATE INDEX "RideRequest_expiresAt_status_idx"
ON "RideRequest"("expiresAt", "status");

CREATE UNIQUE INDEX "RideParticipation_rideOfferId_passengerUserId_key"
ON "RideParticipation"("rideOfferId", "passengerUserId");

CREATE INDEX "RideParticipation_rideOfferId_status_requestedAt_idx"
ON "RideParticipation"("rideOfferId", "status", "requestedAt");

CREATE INDEX "RideParticipation_passengerUserId_status_requestedAt_idx"
ON "RideParticipation"("passengerUserId", "status", "requestedAt");

CREATE UNIQUE INDEX "RideMeetingPoint_participationId_key"
ON "RideMeetingPoint"("participationId");

CREATE UNIQUE INDEX "RideOfferWaypoint_rideOfferId_sequence_key"
ON "RideOfferWaypoint"("rideOfferId", "sequence");

CREATE INDEX "RideOfferWaypoint_rideOfferId_sequence_idx"
ON "RideOfferWaypoint"("rideOfferId", "sequence");

CREATE INDEX "RideOfferWaypoint_placeId_idx"
ON "RideOfferWaypoint"("placeId");

ALTER TABLE "RideOffer"
ADD CONSTRAINT "RideOffer_driverUserId_fkey"
FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideOffer"
ADD CONSTRAINT "RideOffer_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RideOffer"
ADD CONSTRAINT "RideOffer_destinationPlaceId_fkey"
FOREIGN KEY ("destinationPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RideRequest"
ADD CONSTRAINT "RideRequest_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideRequest"
ADD CONSTRAINT "RideRequest_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RideRequest"
ADD CONSTRAINT "RideRequest_destinationPlaceId_fkey"
FOREIGN KEY ("destinationPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RideParticipation"
ADD CONSTRAINT "RideParticipation_rideOfferId_fkey"
FOREIGN KEY ("rideOfferId") REFERENCES "RideOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideParticipation"
ADD CONSTRAINT "RideParticipation_passengerUserId_fkey"
FOREIGN KEY ("passengerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideMeetingPoint"
ADD CONSTRAINT "RideMeetingPoint_participationId_fkey"
FOREIGN KEY ("participationId") REFERENCES "RideParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideOfferWaypoint"
ADD CONSTRAINT "RideOfferWaypoint_rideOfferId_fkey"
FOREIGN KEY ("rideOfferId") REFERENCES "RideOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideOfferWaypoint"
ADD CONSTRAINT "RideOfferWaypoint_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
