CREATE TYPE "RideContext" AS ENUM ('MATCHDAY', 'GENERAL');

CREATE TYPE "RideCompensationType" AS ENUM ('FREE', 'CASH');

CREATE TYPE "RideCompensationBasis" AS ENUM ('PER_SEAT', 'TOTAL');

ALTER TABLE "RideOffer"
ADD COLUMN "context" "RideContext" NOT NULL DEFAULT 'MATCHDAY',
ADD COLUMN "compensationType" "RideCompensationType" NOT NULL DEFAULT 'FREE',
ADD COLUMN "compensationAmountMinor" INTEGER,
ADD COLUMN "compensationCurrency" VARCHAR(3),
ADD COLUMN "compensationBasis" "RideCompensationBasis";

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
    AND "compensationCurrency" ~ '^[A-Z]{3}$'
    AND "compensationBasis" IS NOT NULL
  )
);

CREATE INDEX "RideOffer_context_status_departureAt_id_idx"
ON "RideOffer"("context", "status", "departureAt", "id");

ALTER TABLE "RideRequest"
ADD COLUMN "context" "RideContext" NOT NULL DEFAULT 'MATCHDAY',
ADD COLUMN "compensationType" "RideCompensationType" NOT NULL DEFAULT 'FREE',
ADD COLUMN "compensationAmountMinor" INTEGER,
ADD COLUMN "compensationCurrency" VARCHAR(3),
ADD COLUMN "compensationBasis" "RideCompensationBasis";

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
    AND "compensationCurrency" ~ '^[A-Z]{3}$'
    AND "compensationBasis" IS NULL
  )
);

CREATE INDEX "RideRequest_context_status_desiredDepartureAt_id_idx"
ON "RideRequest"("context", "status", "desiredDepartureAt", "id");
