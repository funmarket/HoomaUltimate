CREATE TYPE "AthletesCalendarEntryStatus" AS ENUM (
  'SCHEDULED',
  'CANCELLED'
);

CREATE TABLE "AthletesCalendarEntry" (
  "id" TEXT NOT NULL,
  "athletesCommunityId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
  "locationName" TEXT,
  "status" "AthletesCalendarEntryStatus" NOT NULL DEFAULT 'SCHEDULED',
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AthletesCalendarEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AthletesCalendarEntry_athletesCommunityId_status_startsAt_id_idx"
  ON "AthletesCalendarEntry"("athletesCommunityId", "status", "startsAt", "id");

CREATE INDEX "AthletesCalendarEntry_createdByUserId_startsAt_idx"
  ON "AthletesCalendarEntry"("createdByUserId", "startsAt");

ALTER TABLE "AthletesCalendarEntry"
  ADD CONSTRAINT "AthletesCalendarEntry_athletesCommunityId_fkey"
  FOREIGN KEY ("athletesCommunityId") REFERENCES "AthletesCommunity"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AthletesCalendarEntry"
  ADD CONSTRAINT "AthletesCalendarEntry_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
