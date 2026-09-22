-- Requests taxonomy root: SPORT | COMMUNITY.
-- Forward-only expand migration. No historical migration is edited and no existing
-- Request row is deleted: legacy rows keep their data, and taxonomy-linked rows are
-- deterministically backfilled to the SPORT root because every subcategory that
-- existed before this migration is a sport subcategory.

CREATE TYPE "HelpRequestType" AS ENUM ('SPORT', 'COMMUNITY');

ALTER TABLE "HelpTaxonomySubcategory"
  ADD COLUMN "requestType" "HelpRequestType" NOT NULL DEFAULT 'SPORT';

-- Community subcategories belong to no sport; sport stays mandatory for SPORT rows
-- by application validation plus the HelpRequest CHECK constraint below.
ALTER TABLE "HelpTaxonomySubcategory"
  ALTER COLUMN "sport" DROP NOT NULL;

CREATE UNIQUE INDEX "HelpTaxonomySubcategory_id_requestType_key"
  ON "HelpTaxonomySubcategory"("id", "requestType");

-- (sport, slug) cannot enforce uniqueness for community rows because PostgreSQL treats
-- NULLs as distinct in a plain unique index, so community slugs are enforced separately.
CREATE UNIQUE INDEX "HelpTaxonomySubcategory_community_slug_key"
  ON "HelpTaxonomySubcategory"("slug") WHERE "requestType" = 'COMMUNITY';

CREATE INDEX "HelpTaxonomySubcategory_requestType_sport_active_sortOrder_idx"
  ON "HelpTaxonomySubcategory"("requestType", "sport", "active", "sortOrder");

ALTER TABLE "HelpRequest"
  ADD COLUMN "requestType" "HelpRequestType",
  ADD COLUMN "fullAddress" TEXT;

-- Deterministic backfill of the new root: before this migration the only taxonomy
-- nodes in existence were sport subcategories, so every linked Request is SPORT.
UPDATE "HelpRequest"
  SET "requestType" = 'SPORT'
  WHERE "subcategoryId" IS NOT NULL AND "requestType" IS NULL;

CREATE INDEX "HelpRequest_requestType_status_createdAt_idx"
  ON "HelpRequest"("requestType", "status", "createdAt");

-- Replace the former sport-only guard with a root-aware one so a community Request
-- can never carry a sport and a sport Request can never lose its sport.
ALTER TABLE "HelpRequest"
  DROP CONSTRAINT "HelpRequest_subcategory_requires_sport_check";

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_taxonomy_root_check"
  CHECK (
    ("subcategoryId" IS NULL AND "requestType" IS NULL)
    OR ("requestType" = 'SPORT' AND "sport" IS NOT NULL)
    OR ("requestType" = 'COMMUNITY' AND "sport" IS NULL)
  );

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategoryId_requestType_fkey"
  FOREIGN KEY ("subcategoryId", "requestType") REFERENCES "HelpTaxonomySubcategory"("id", "requestType")
  ON DELETE RESTRICT ON UPDATE CASCADE;
