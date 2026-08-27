ALTER TABLE "PlaceCapabilityApplication"
  ADD COLUMN "hourlyRateMinor" INTEGER,
  ADD COLUMN "currency" VARCHAR(3);

ALTER TABLE "PlaceCapabilityApplication"
  ADD CONSTRAINT "PlaceCapabilityApplication_hourlyRateMinor_nonnegative"
  CHECK ("hourlyRateMinor" IS NULL OR "hourlyRateMinor" >= 0);

ALTER TABLE "PlaceCapabilityApplication"
  ADD CONSTRAINT "PlaceCapabilityApplication_pitch_pricing_pair"
  CHECK (
    ("hourlyRateMinor" IS NULL AND "currency" IS NULL)
    OR
    ("hourlyRateMinor" IS NOT NULL AND "currency" IS NOT NULL AND char_length("currency") = 3)
  );
