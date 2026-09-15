ALTER TABLE "AthletesCalendarEntry"
ADD COLUMN "photoUrl" TEXT,
ADD COLUMN "photoMediaId" TEXT,
ADD COLUMN "photoObjectKey" TEXT,
ADD COLUMN "photoContentType" TEXT,
ADD COLUMN "photoSizeBytes" INTEGER;

CREATE UNIQUE INDEX "AthletesCalendarEntry_photoMediaId_key"
ON "AthletesCalendarEntry"("photoMediaId");

CREATE UNIQUE INDEX "AthletesCalendarEntry_photoObjectKey_key"
ON "AthletesCalendarEntry"("photoObjectKey");

ALTER TABLE "AthletesCalendarEntry"
ADD CONSTRAINT "AthletesCalendarEntry_photo_source_check"
CHECK (
  (
    "photoUrl" IS NULL
    AND "photoMediaId" IS NULL
    AND "photoObjectKey" IS NULL
    AND "photoContentType" IS NULL
    AND "photoSizeBytes" IS NULL
  )
  OR (
    "photoUrl" IS NOT NULL
    AND "photoMediaId" IS NULL
    AND "photoObjectKey" IS NULL
    AND "photoContentType" IS NULL
    AND "photoSizeBytes" IS NULL
  )
  OR (
    "photoUrl" IS NULL
    AND "photoMediaId" IS NOT NULL
    AND "photoObjectKey" IS NOT NULL
    AND "photoContentType" IS NOT NULL
    AND "photoSizeBytes" IS NOT NULL
    AND "photoSizeBytes" > 0
    AND "photoSizeBytes" <= 5242880
  )
);
