-- CreateEnum
CREATE TYPE "GamerChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GamerChallenge" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "challengerProfileId" TEXT NOT NULL,
    "challengedProfileId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "status" "GamerChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamerChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GamerChallenge_distinct_profiles_check" CHECK ("challengerProfileId" <> "challengedProfileId")
);

-- CreateIndex
CREATE INDEX "GamerChallenge_gameId_status_createdAt_idx" ON "GamerChallenge"("gameId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GamerChallenge_challengerProfileId_status_createdAt_idx" ON "GamerChallenge"("challengerProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GamerChallenge_challengedProfileId_status_createdAt_idx" ON "GamerChallenge"("challengedProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GamerChallenge_gameId_pairKey_status_idx" ON "GamerChallenge"("gameId", "pairKey", "status");

-- Prevent same-direction and reverse-direction duplicate unresolved challenges.
CREATE UNIQUE INDEX "GamerChallenge_one_pending_pair_per_game_key" ON "GamerChallenge"("gameId", "pairKey") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GamerGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_challengerProfileId_fkey" FOREIGN KEY ("challengerProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_challengedProfileId_fkey" FOREIGN KEY ("challengedProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
