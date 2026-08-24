-- Team lineup current state, pitch coordinates, and canonical TeamPlayer ownership.
ALTER TABLE "TeamLineup"
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing behavior by making only the latest active lineup current for each Team.
WITH latest AS (
  SELECT DISTINCT ON ("teamId") "id"
  FROM "TeamLineup"
  WHERE "active" = true
  ORDER BY "teamId", "updatedAt" DESC, "id" DESC
)
UPDATE "TeamLineup" AS lineup
SET "isCurrent" = true
FROM latest
WHERE lineup."id" = latest."id";

CREATE UNIQUE INDEX "TeamLineup_one_current_per_team_key"
  ON "TeamLineup"("teamId")
  WHERE "isCurrent" = true AND "active" = true;
CREATE INDEX "TeamLineup_teamId_isCurrent_active_idx"
  ON "TeamLineup"("teamId", "isCurrent", "active");

ALTER TABLE "TeamLineupSlot"
  ADD COLUMN "x" DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN "y" DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN "teamPlayerId" TEXT,
  ADD COLUMN "isStarter" BOOLEAN NOT NULL DEFAULT true;

-- Preserve valid historical assignments by resolving the existing User link
-- through the lineup Team to its canonical TeamPlayer membership.
UPDATE "TeamLineupSlot" AS slot
SET "teamPlayerId" = player."id"
FROM "TeamLineup" AS lineup, "TeamPlayer" AS player
WHERE lineup."id" = slot."lineupId"
  AND player."teamId" = lineup."teamId"
  AND player."userId" = slot."userId";

ALTER TABLE "TeamLineupSlot" DROP CONSTRAINT "TeamLineupSlot_userId_fkey";
ALTER TABLE "TeamLineupSlot" DROP COLUMN "userId";

ALTER TABLE "TeamLineupSlot"
  ADD CONSTRAINT "TeamLineupSlot_x_range" CHECK ("x" >= 0 AND "x" <= 100),
  ADD CONSTRAINT "TeamLineupSlot_y_range" CHECK ("y" >= 0 AND "y" <= 100),
  ADD CONSTRAINT "TeamLineupSlot_teamPlayerId_fkey"
    FOREIGN KEY ("teamPlayerId") REFERENCES "TeamPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TeamLineupSlot_teamPlayerId_idx" ON "TeamLineupSlot"("teamPlayerId");
