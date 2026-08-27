ALTER TABLE "TeamChallenge"
ADD COLUMN "placeId" TEXT,
ADD COLUMN "venueName" TEXT,
ADD COLUMN "address" TEXT;

ALTER TABLE "TeamGame"
ADD COLUMN "placeId" TEXT,
ADD COLUMN "venueName" TEXT,
ADD COLUMN "address" TEXT;

ALTER TABLE "TeamChallenge"
ADD CONSTRAINT "TeamChallenge_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeamGame"
ADD CONSTRAINT "TeamGame_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "TeamChallenge_placeId_status_createdAt_idx"
ON "TeamChallenge"("placeId", "status", "createdAt");

CREATE INDEX "TeamGame_placeId_scheduledAt_idx"
ON "TeamGame"("placeId", "scheduledAt");
