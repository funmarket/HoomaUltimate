CREATE TABLE "PlaceCapability" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "kind" "PlaceCapabilityKind" NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "hourlyRateMinor" INTEGER,
    "currency" VARCHAR(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceCapability_placeId_kind_key"
ON "PlaceCapability"("placeId", "kind");

CREATE INDEX "PlaceCapability_kind_status_updatedAt_idx"
ON "PlaceCapability"("kind", "status", "updatedAt");

ALTER TABLE "PlaceCapability"
ADD CONSTRAINT "PlaceCapability_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlaceCapability" (
    "id",
    "placeId",
    "kind",
    "status",
    "summary",
    "hourlyRateMinor",
    "currency",
    "reviewedByUserId",
    "reviewedAt",
    "reviewNote",
    "createdAt",
    "updatedAt"
)
SELECT
    'cap_' || application."id",
    application."placeId",
    application."kind",
    'APPROVED'::"ModerationStatus",
    application."summary",
    application."hourlyRateMinor",
    application."currency",
    application."reviewedByUserId",
    application."reviewedAt",
    application."reviewNote",
    application."createdAt",
    application."updatedAt"
FROM "PlaceCapabilityApplication" application
WHERE application."status" = 'APPROVED'
ON CONFLICT ("placeId", "kind") DO NOTHING;
