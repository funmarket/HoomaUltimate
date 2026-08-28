ALTER TABLE "PlaceCapability"
ADD CONSTRAINT "PlaceCapability_pitch_pricing_required"
CHECK (
  "kind" <> 'PITCH'
  OR (
    "hourlyRateMinor" IS NOT NULL
    AND "hourlyRateMinor" >= 0
    AND "currency" IN ('TND', 'EUR', 'USD')
  )
) NOT VALID;

ALTER TABLE "PlaceCapabilityApplication"
ADD CONSTRAINT "PlaceCapabilityApplication_pitch_pricing_required"
CHECK (
  "kind" <> 'PITCH'
  OR (
    "hourlyRateMinor" IS NOT NULL
    AND "hourlyRateMinor" >= 0
    AND "currency" IN ('TND', 'EUR', 'USD')
  )
) NOT VALID;
