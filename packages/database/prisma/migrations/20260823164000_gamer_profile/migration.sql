-- CreateTable
CREATE TABLE "GamerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "openToChallenge" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamerProfile_userId_gameId_key" ON "GamerProfile"("userId", "gameId");

-- CreateIndex
CREATE INDEX "GamerProfile_gameId_openToChallenge_updatedAt_idx" ON "GamerProfile"("gameId", "openToChallenge", "updatedAt");

-- AddForeignKey
ALTER TABLE "GamerProfile" ADD CONSTRAINT "GamerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamerProfile" ADD CONSTRAINT "GamerProfile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GamerGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
