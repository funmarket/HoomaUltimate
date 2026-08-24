CREATE TYPE "TeamPlayerOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "TeamPlayerOffer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "offeredByUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "TeamPlayerOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPlayerOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamPlayerOffer_teamId_targetUserId_key"
ON "TeamPlayerOffer"("teamId", "targetUserId");

CREATE INDEX "TeamPlayerOffer_targetUserId_status_createdAt_idx"
ON "TeamPlayerOffer"("targetUserId", "status", "createdAt");

CREATE INDEX "TeamPlayerOffer_teamId_status_createdAt_idx"
ON "TeamPlayerOffer"("teamId", "status", "createdAt");

ALTER TABLE "TeamPlayerOffer"
ADD CONSTRAINT "TeamPlayerOffer_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamPlayerOffer"
ADD CONSTRAINT "TeamPlayerOffer_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamPlayerOffer"
ADD CONSTRAINT "TeamPlayerOffer_offeredByUserId_fkey"
FOREIGN KEY ("offeredByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
