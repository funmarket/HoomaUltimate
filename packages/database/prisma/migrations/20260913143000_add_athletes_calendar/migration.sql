CREATE TABLE "AthletesCalendarEntry" (
    "id" TEXT NOT NULL,
    "athletesCommunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletesCalendarEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AthletesCalendarEntry_time_order_check" CHECK ("endsAt" > "startsAt")
);

CREATE INDEX "AthletesCalendarEntry_athletesCommunityId_startsAt_id_idx"
ON "AthletesCalendarEntry"("athletesCommunityId", "startsAt", "id");

CREATE INDEX "AthletesCalendarEntry_athletesCommunityId_cancelledAt_startsAt_idx"
ON "AthletesCalendarEntry"("athletesCommunityId", "cancelledAt", "startsAt");

ALTER TABLE "AthletesCalendarEntry"
ADD CONSTRAINT "AthletesCalendarEntry_athletesCommunityId_fkey"
FOREIGN KEY ("athletesCommunityId") REFERENCES "AthletesCommunity"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AthletesCalendarEntry"
ADD CONSTRAINT "AthletesCalendarEntry_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
