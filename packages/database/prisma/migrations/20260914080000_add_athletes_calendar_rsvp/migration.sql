CREATE TYPE "AthletesCalendarRsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

CREATE TABLE "AthletesCalendarRsvp" (
    "id" TEXT NOT NULL,
    "calendarEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AthletesCalendarRsvpStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletesCalendarRsvp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AthletesCalendarRsvp_calendarEntryId_userId_key"
ON "AthletesCalendarRsvp"("calendarEntryId", "userId");

CREATE INDEX "AthletesCalendarRsvp_calendarEntryId_status_idx"
ON "AthletesCalendarRsvp"("calendarEntryId", "status");

CREATE INDEX "AthletesCalendarRsvp_userId_idx"
ON "AthletesCalendarRsvp"("userId");

ALTER TABLE "AthletesCalendarRsvp"
ADD CONSTRAINT "AthletesCalendarRsvp_calendarEntryId_fkey"
FOREIGN KEY ("calendarEntryId") REFERENCES "AthletesCalendarEntry"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AthletesCalendarRsvp"
ADD CONSTRAINT "AthletesCalendarRsvp_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
