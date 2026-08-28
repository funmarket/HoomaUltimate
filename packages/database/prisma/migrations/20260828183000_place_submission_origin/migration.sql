-- Place submission provenance becomes a first-class immutable source fact.
-- Existing rows are intentionally left NULL because production history has not been
-- verified strongly enough to classify them as OWNER or FANHUB without guessing.
CREATE TYPE "PlaceSubmissionOrigin" AS ENUM ('OWNER', 'FANHUB');

ALTER TABLE "Place"
  ADD COLUMN "submissionOrigin" "PlaceSubmissionOrigin";

CREATE INDEX "Place_submissionOrigin_moderationStatus_archivedAt_idx"
  ON "Place"("submissionOrigin", "moderationStatus", "archivedAt");

-- Duplicate detection reads canonical source fields directly. These expression indexes
-- accelerate the same normalization used by the Place repository without introducing
-- duplicated normalized columns or a second source of truth.
CREATE INDEX "Place_active_normalized_name_address_idx"
  ON "Place" (
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim("address"), '\s+', ' ', 'g'))
  )
  WHERE "archivedAt" IS NULL AND "moderationStatus" IN ('PENDING', 'APPROVED');

CREATE INDEX "Place_active_normalized_phone_idx"
  ON "Place" (regexp_replace("phone", '[^0-9]', '', 'g'))
  WHERE "archivedAt" IS NULL
    AND "moderationStatus" IN ('PENDING', 'APPROVED')
    AND "phone" IS NOT NULL;

CREATE INDEX "Place_active_normalized_website_idx"
  ON "Place" (
    lower(
      regexp_replace(
        regexp_replace(btrim("websiteUrl"), '^https?://(www\.)?', '', 'i'),
        '/+$',
        ''
      )
    )
  )
  WHERE "archivedAt" IS NULL
    AND "moderationStatus" IN ('PENDING', 'APPROVED')
    AND "websiteUrl" IS NOT NULL;

CREATE INDEX "Place_active_coordinates_name_idx"
  ON "Place" (
    "latitude",
    "longitude",
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
  )
  WHERE "archivedAt" IS NULL
    AND "moderationStatus" IN ('PENDING', 'APPROVED')
    AND "latitude" IS NOT NULL
    AND "longitude" IS NOT NULL;
