-- HOOMA NOW reads only currently discoverable lifecycle states.
-- Partial indexes keep the read-path indexes small while preserving each domain's canonical tables.

CREATE INDEX "Event_discovery_published_startsAt_id_idx"
ON "Event" ("startsAt", "id")
WHERE "status" = 'PUBLISHED';

CREATE INDEX "Event_discovery_published_endsAt_idx"
ON "Event" ("endsAt")
WHERE "status" = 'PUBLISHED' AND "endsAt" IS NOT NULL;

CREATE INDEX "TeamGame_discovery_confirmed_scheduledAt_id_idx"
ON "TeamGame" ("scheduledAt", "id")
WHERE "status" = 'CONFIRMED' AND "scheduledAt" IS NOT NULL;

CREATE INDEX "TeamGame_discovery_confirmed_endsAt_idx"
ON "TeamGame" ("endsAt")
WHERE "status" = 'CONFIRMED' AND "endsAt" IS NOT NULL;

CREATE INDEX "GamerChallenge_discovery_accepted_respondedAt_id_idx"
ON "GamerChallenge" ("respondedAt" DESC, "id" ASC)
WHERE "status" = 'ACCEPTED' AND "respondedAt" IS NOT NULL;
