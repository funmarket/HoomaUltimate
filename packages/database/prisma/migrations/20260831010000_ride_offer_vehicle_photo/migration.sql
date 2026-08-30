CREATE TABLE "RideOfferVehiclePhoto" (
    "id" TEXT NOT NULL,
    "rideOfferId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideOfferVehiclePhoto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RideOfferVehiclePhoto_size_bytes_positive_check" CHECK ("sizeBytes" > 0)
);

CREATE UNIQUE INDEX "RideOfferVehiclePhoto_rideOfferId_key"
ON "RideOfferVehiclePhoto"("rideOfferId");

CREATE UNIQUE INDEX "RideOfferVehiclePhoto_objectKey_key"
ON "RideOfferVehiclePhoto"("objectKey");

CREATE INDEX "RideOfferVehiclePhoto_createdAt_idx"
ON "RideOfferVehiclePhoto"("createdAt");

ALTER TABLE "RideOfferVehiclePhoto"
ADD CONSTRAINT "RideOfferVehiclePhoto_rideOfferId_fkey"
FOREIGN KEY ("rideOfferId") REFERENCES "RideOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
