-- HOOMA NOW reads only the current public lifecycle state from each owning domain.
-- Partial indexes keep these read paths small without duplicating Discovery state.

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
ON "GamerChallenge" ("respondedAt" DESC, "id")
WHERE "status" = 'ACCEPTED' AND "respondedAt" IS NOT NULL;
