CREATE TYPE "EventPlayerInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "EventPlayerInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" "EventPlayerInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPlayerInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventPlayerInvite_eventId_targetUserId_key"
ON "EventPlayerInvite"("eventId", "targetUserId");

CREATE INDEX "EventPlayerInvite_targetUserId_status_createdAt_idx"
ON "EventPlayerInvite"("targetUserId", "status", "createdAt");

CREATE INDEX "EventPlayerInvite_eventId_status_createdAt_idx"
ON "EventPlayerInvite"("eventId", "status", "createdAt");

CREATE INDEX "EventPlayerInvite_invitedByUserId_status_createdAt_idx"
ON "EventPlayerInvite"("invitedByUserId", "status", "createdAt");

ALTER TABLE "EventPlayerInvite"
ADD CONSTRAINT "EventPlayerInvite_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPlayerInvite"
ADD CONSTRAINT "EventPlayerInvite_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPlayerInvite"
ADD CONSTRAINT "EventPlayerInvite_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
