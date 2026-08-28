-- Pitch applications own only reviewed Pitch profile/pricing fields.
-- Canonical contact remains on Place (phone/email/websiteUrl).
ALTER TABLE "PlaceCapabilityApplication"
  DROP COLUMN "contactName",
  DROP COLUMN "contactPhone",
  DROP COLUMN "contactEmail";
