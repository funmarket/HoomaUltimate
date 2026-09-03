-- Preserve legacy check-in evidence before removing the duplicated RSVP timestamp.
-- The historical check-in writer always populated EventRsvp.checkedInAt at the same
-- operation that created EventCheckIn, but this backfill also protects rows where
-- those writes became inconsistent.
INSERT INTO "EventCheckIn" ("id", "eventId", "userId", "latitude", "longitude", "createdAt")
SELECT
  'legacy-checkin-' || r."id",
  r."eventId",
  r."userId",
  NULL,
  NULL,
  r."checkedInAt"
FROM "EventRsvp" r
WHERE r."checkedInAt" IS NOT NULL
ON CONFLICT ("eventId", "userId") DO NOTHING;

-- The only source writer that could set ATTENDED while an Event was still PUBLISHED
-- was the defective check-in path. Restore those live reservations to CONFIRMED while
-- preserving the independent EventCheckIn fact. Completed historical attendance is
-- intentionally not rewritten.
UPDATE "EventRsvp" r
SET "status" = 'CONFIRMED', "updatedAt" = NOW()
FROM "Event" e
WHERE r."eventId" = e."id"
  AND e."status" = 'PUBLISHED'
  AND r."status" = 'ATTENDED'
  AND EXISTS (
    SELECT 1
    FROM "EventCheckIn" c
    WHERE c."eventId" = r."eventId"
      AND c."userId" = r."userId"
  );

ALTER TABLE "EventRsvp" DROP COLUMN "checkedInAt";
