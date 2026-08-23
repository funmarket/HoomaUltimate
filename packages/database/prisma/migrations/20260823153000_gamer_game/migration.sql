-- CreateEnum
CREATE TYPE "GamerGameStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "GamerGame" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" "GamerGameStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamerGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamerGame_slug_key" ON "GamerGame"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GamerGame_normalizedName_key" ON "GamerGame"("normalizedName");

-- CreateIndex
CREATE INDEX "GamerGame_status_name_idx" ON "GamerGame"("status", "name");

-- CreateIndex
CREATE INDEX "GamerGame_createdByUserId_createdAt_idx" ON "GamerGame"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "GamerGame" ADD CONSTRAINT "GamerGame_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed launch catalog from the approved G1 product scope.
INSERT INTO "GamerGame" ("id", "slug", "name", "normalizedName", "status", "createdByUserId", "createdAt", "updatedAt")
VALUES
    ('gamer_game_fc_mobile', 'ea-sports-fc-mobile', 'EA SPORTS FC Mobile', 'ea sports fc mobile', 'ACTIVE', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('gamer_game_ludo', 'ludo', 'Ludo', 'ludo', 'ACTIVE', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
