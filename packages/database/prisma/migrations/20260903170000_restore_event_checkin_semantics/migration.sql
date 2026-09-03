-- Restore the Event check-in contract that existed before the temporary
-- attendance-finalization redesign. The prior migration is already applied
-- in deployed environments, so it remains immutable migration history.
ALTER TABLE "EventRsvp"
ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);

-- In the original contract, check-in itself marks the RSVP ATTENDED and
-- EventRsvp.checkedInAt records the check-in time. EventCheckIn remains the
-- one-per-Event/User check-in record.
UPDATE "EventRsvp" AS r
SET
  "checkedInAt" = COALESCE(r."checkedInAt", c."createdAt"),
  "status" = CASE
    WHEN r."status" = 'CONFIRMED' THEN 'ATTENDED'::"EventRsvpStatus"
    ELSE r."status"
  END,
  "updatedAt" = CASE
    WHEN r."status" = 'CONFIRMED' THEN NOW()
    ELSE r."updatedAt"
  END
FROM "EventCheckIn" AS c
WHERE c."eventId" = r."eventId"
  AND c."userId" = r."userId"
  AND r."status" IN ('CONFIRMED', 'ATTENDED');

-- The temporary redesign could write NO_SHOW only when completing an Event.
-- Restore only rows written after that redesign migration was applied, and
-- only when no check-in exists. Historical rows before that boundary remain
-- untouched.
WITH lifecycle_migration AS (
  SELECT "finished_at"
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260903160000_event_attendance_lifecycle'
    AND "rolled_back_at" IS NULL
    AND "finished_at" IS NOT NULL
  ORDER BY "finished_at" DESC
  LIMIT 1
)
UPDATE "EventRsvp" AS r
SET "status" = 'CONFIRMED', "updatedAt" = NOW()
FROM "Event" AS e, lifecycle_migration AS m
WHERE r."eventId" = e."id"
  AND r."status" = 'NO_SHOW'
  AND e."status" = 'COMPLETED'
  AND r."updatedAt" >= m."finished_at"
  AND e."updatedAt" >= m."finished_at"
  AND NOT EXISTS (
    SELECT 1
    FROM "EventCheckIn" AS c
    WHERE c."eventId" = r."eventId"
      AND c."userId" = r."userId"
  );
