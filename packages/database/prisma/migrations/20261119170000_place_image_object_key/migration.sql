-- Preserve historical managed and external Place images while new managed uploads persist
-- their exact typed object-storage identity.
ALTER TABLE "PlaceImage" ADD COLUMN "objectKey" TEXT;

CREATE INDEX "PlaceImage_objectKey_idx" ON "PlaceImage"("objectKey");
