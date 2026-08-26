-- Watch no longer has a second capability/application approval layer.
-- Pitch remains on PlaceCapabilityApplication and is intentionally preserved.
DELETE FROM "PlaceCapabilityApplication" WHERE "kind" = 'WATCH';

-- Place submission and ownership review are App Admin-only. Remove stale delegated grants.
DELETE FROM "AppManagerGrant"
WHERE "capability" IN ('REVIEW_PLACES', 'REVIEW_PLACE_OWNERSHIP', 'REVIEW_WATCH_APPLICATIONS');

-- PostgreSQL enum values are removed by recreating the enum types with only active values.
ALTER TYPE "PlaceCapabilityKind" RENAME TO "PlaceCapabilityKind_old";
CREATE TYPE "PlaceCapabilityKind" AS ENUM ('PITCH');
ALTER TABLE "PlaceCapabilityApplication"
  ALTER COLUMN "kind" TYPE "PlaceCapabilityKind"
  USING ("kind"::text::"PlaceCapabilityKind");
DROP TYPE "PlaceCapabilityKind_old";

ALTER TYPE "AppManagerCapability" RENAME TO "AppManagerCapability_old";
CREATE TYPE "AppManagerCapability" AS ENUM ('REVIEW_PITCH_APPLICATIONS', 'VIEW_AUDIT');
ALTER TABLE "AppManagerGrant"
  ALTER COLUMN "capability" TYPE "AppManagerCapability"
  USING ("capability"::text::"AppManagerCapability");
DROP TYPE "AppManagerCapability_old";

-- Canonical Place business information used by Places, Watch tickets, and Place detail.
ALTER TABLE "Place"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "description" TEXT;

-- WATCH Events use canonical Place identity and do not fabricate a Community.
ALTER TABLE "Event" ALTER COLUMN "communityId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN "placeId" TEXT;
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Event_placeId_type_status_startsAt_idx"
  ON "Event"("placeId", "type", "status", "startsAt");
