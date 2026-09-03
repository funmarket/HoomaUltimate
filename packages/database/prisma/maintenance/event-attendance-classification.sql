-- Pre-deployment classification for the Event RSVP/check-in/attendance lifecycle repair.
-- Run against the target database before applying the lifecycle migration and review counts.

SELECT
  e."type" AS "eventType",
  e."status" AS "eventStatus",
  r."status" AS "rsvpStatus",
  (r."checkedInAt" IS NOT NULL) AS "hasLegacyRsvpCheckInTimestamp",
  (c."id" IS NOT NULL) AS "hasEventCheckIn",
  COUNT(*)::bigint AS "rowCount"
FROM "EventRsvp" r
JOIN "Event" e ON e."id" = r."eventId"
LEFT JOIN "EventCheckIn" c
  ON c."eventId" = r."eventId"
 AND c."userId" = r."userId"
GROUP BY
  e."type",
  e."status",
  r."status",
  (r."checkedInAt" IS NOT NULL),
  (c."id" IS NOT NULL)
ORDER BY 1, 2, 3, 4, 5;

-- Rows with a legacy RSVP timestamp but no canonical EventCheckIn are backfilled by migration.
SELECT r."id", r."eventId", r."userId", r."status", r."checkedInAt"
FROM "EventRsvp" r
LEFT JOIN "EventCheckIn" c
  ON c."eventId" = r."eventId"
 AND c."userId" = r."userId"
WHERE r."checkedInAt" IS NOT NULL
  AND c."id" IS NULL
ORDER BY r."checkedInAt", r."id";

-- These are the provably premature ATTENDED rows repaired by migration: the Event is
-- still PUBLISHED, while the only historical ATTENDED writer was check-in itself.
SELECT r."id", r."eventId", r."userId", e."type", e."startsAt", e."endsAt", c."createdAt" AS "checkedInAt"
FROM "EventRsvp" r
JOIN "Event" e ON e."id" = r."eventId"
JOIN "EventCheckIn" c
  ON c."eventId" = r."eventId"
 AND c."userId" = r."userId"
WHERE e."status" = 'PUBLISHED'
  AND r."status" = 'ATTENDED'
ORDER BY e."startsAt", r."id";

-- Completed ATTENDED rows are intentionally retained as historical attendance.
SELECT COUNT(*)::bigint AS "completedAttendedCount"
FROM "EventRsvp" r
JOIN "Event" e ON e."id" = r."eventId"
WHERE e."status" = 'COMPLETED'
  AND r."status" = 'ATTENDED';
