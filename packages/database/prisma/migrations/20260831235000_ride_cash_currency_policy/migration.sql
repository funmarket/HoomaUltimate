DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RideOffer"
    WHERE "compensationType" = 'CASH'
      AND "compensationCurrency" IS NOT NULL
      AND "compensationCurrency" NOT IN ('TND', 'EUR', 'USD')
  ) THEN
    RAISE EXCEPTION 'Unsupported RideOffer compensationCurrency found; refusing to change Ride cash currency constraint';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "RideRequest"
    WHERE "compensationType" = 'CASH'
      AND "compensationCurrency" IS NOT NULL
      AND "compensationCurrency" NOT IN ('TND', 'EUR', 'USD')
  ) THEN
    RAISE EXCEPTION 'Unsupported RideRequest compensationCurrency found; refusing to change Ride cash currency constraint';
  END IF;
END $$;

ALTER TABLE "RideOffer"
DROP CONSTRAINT "RideOffer_compensation_terms_check";

ALTER TABLE "RideOffer"
ADD CONSTRAINT "RideOffer_compensation_terms_check"
CHECK (
  (
    "compensationType" = 'FREE'
    AND "compensationAmountMinor" IS NULL
    AND "compensationCurrency" IS NULL
    AND "compensationBasis" IS NULL
  )
  OR
  (
    "compensationType" = 'CASH'
    AND "compensationAmountMinor" IS NOT NULL
    AND "compensationAmountMinor" > 0
    AND "compensationCurrency" IN ('TND', 'EUR', 'USD')
    AND "compensationBasis" IS NOT NULL
  )
);

ALTER TABLE "RideRequest"
DROP CONSTRAINT "RideRequest_compensation_terms_check";

ALTER TABLE "RideRequest"
ADD CONSTRAINT "RideRequest_compensation_terms_check"
CHECK (
  (
    "compensationType" = 'FREE'
    AND "compensationAmountMinor" IS NULL
    AND "compensationCurrency" IS NULL
    AND "compensationBasis" IS NULL
  )
  OR
  (
    "compensationType" = 'CASH'
    AND "compensationAmountMinor" IS NOT NULL
    AND "compensationAmountMinor" > 0
    AND "compensationCurrency" IN ('TND', 'EUR', 'USD')
    AND "compensationBasis" IS NULL
  )
);
