-- Team lineup slots are roster membership references, not direct User references.
-- Fail closed if existing data cannot be mapped to the owning Team's roster.

ALTER TABLE "TeamLineupSlot"
ADD COLUMN "teamPlayerId" TEXT;

UPDATE "TeamLineupSlot" AS slot
SET "teamPlayerId" = player."id"
FROM "TeamLineup" AS lineup,
     "TeamPlayer" AS player
WHERE slot."lineupId" = lineup."id"
  AND slot."userId" IS NOT NULL
  AND player."teamId" = lineup."teamId"
  AND player."userId" = slot."userId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TeamLineupSlot"
    WHERE "userId" IS NOT NULL
      AND "teamPlayerId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate TeamLineupSlot: existing slot references a User who is not on the lineup Team roster';
  END IF;
END $$;

ALTER TABLE "TeamLineupSlot"
DROP CONSTRAINT "TeamLineupSlot_userId_fkey";

DROP INDEX IF EXISTS "TeamLineupSlot_userId_idx";

ALTER TABLE "TeamLineupSlot"
DROP COLUMN "userId";

CREATE INDEX "TeamLineupSlot_teamPlayerId_idx"
ON "TeamLineupSlot"("teamPlayerId");

ALTER TABLE "TeamLineupSlot"
ADD CONSTRAINT "TeamLineupSlot_teamPlayerId_fkey"
FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
