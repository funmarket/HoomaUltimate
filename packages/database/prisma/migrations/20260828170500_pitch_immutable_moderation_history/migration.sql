DROP INDEX "PlaceCapabilityApplication_placeId_kind_key";

CREATE UNIQUE INDEX "PlaceCapabilityApplication_one_pending_per_place_kind"
ON "PlaceCapabilityApplication"("placeId", "kind")
WHERE "status" = 'PENDING';
