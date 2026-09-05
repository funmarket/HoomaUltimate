CREATE TABLE "AthletesPhoto" (
    "id" TEXT NOT NULL,
    "athletesCommunityId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletesPhoto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AthletesPhoto_size_bytes_positive_check" CHECK ("sizeBytes" > 0)
);

CREATE UNIQUE INDEX "AthletesPhoto_objectKey_key"
ON "AthletesPhoto"("objectKey");

CREATE INDEX "AthletesPhoto_athletesCommunityId_createdAt_id_idx"
ON "AthletesPhoto"("athletesCommunityId", "createdAt", "id");

CREATE INDEX "AthletesPhoto_uploadedByUserId_createdAt_idx"
ON "AthletesPhoto"("uploadedByUserId", "createdAt");

ALTER TABLE "AthletesPhoto"
ADD CONSTRAINT "AthletesPhoto_athletesCommunityId_fkey"
FOREIGN KEY ("athletesCommunityId") REFERENCES "AthletesCommunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AthletesPhoto"
ADD CONSTRAINT "AthletesPhoto_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
