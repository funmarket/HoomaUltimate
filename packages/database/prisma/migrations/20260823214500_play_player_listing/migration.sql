CREATE TYPE "PlayLookingFor" AS ENUM ('GAME', 'TEAM');

CREATE TABLE "PlayPlayerListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookingFor" "PlayLookingFor" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayPlayerListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayPlayerListing_userId_key"
ON "PlayPlayerListing"("userId");

CREATE INDEX "PlayPlayerListing_lookingFor_updatedAt_idx"
ON "PlayPlayerListing"("lookingFor", "updatedAt");

ALTER TABLE "PlayPlayerListing"
ADD CONSTRAINT "PlayPlayerListing_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
