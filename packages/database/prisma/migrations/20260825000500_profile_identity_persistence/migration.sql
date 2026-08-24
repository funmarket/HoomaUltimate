-- CreateEnum
CREATE TYPE "ProfileIdentity" AS ENUM ('PLAYER', 'FAN', 'GAMER');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "identities" "ProfileIdentity"[] NOT NULL DEFAULT ARRAY[]::"ProfileIdentity"[];

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "userId" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "preferredPositions" TEXT[] NOT NULL,
    "overallRating" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "PlayerProfile_overallRating_check" CHECK ("overallRating" >= 0 AND "overallRating" <= 100)
);

-- Backfill explicit participation evidence without fabricating PlayerProfile details.
UPDATE "User" AS "u"
SET "identities" = array_append("u"."identities", 'GAMER'::"ProfileIdentity")
WHERE EXISTS (
    SELECT 1
    FROM "GamerProfile" AS "gp"
    WHERE "gp"."userId" = "u"."id"
)
AND NOT ("u"."identities" @> ARRAY['GAMER'::"ProfileIdentity"]);

UPDATE "User" AS "u"
SET "identities" = array_append("u"."identities", 'PLAYER'::"ProfileIdentity")
WHERE (
    EXISTS (
        SELECT 1
        FROM "TeamPlayer" AS "tp"
        WHERE "tp"."userId" = "u"."id"
          AND "tp"."active" = TRUE
    )
    OR EXISTS (
        SELECT 1
        FROM "PlayPlayerListing" AS "ppl"
        WHERE "ppl"."userId" = "u"."id"
    )
)
AND NOT ("u"."identities" @> ARRAY['PLAYER'::"ProfileIdentity"]);

-- AddForeignKey
ALTER TABLE "PlayerProfile"
ADD CONSTRAINT "PlayerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
