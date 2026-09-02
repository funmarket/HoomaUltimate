CREATE TYPE "UserNotificationType" AS ENUM ('DIRECT_USER_WHISTLE', 'RIDE_WHISTLE');

CREATE TABLE "UserNotification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "type" "UserNotificationType" NOT NULL,
  "contextType" "WhistleContextType" NOT NULL,
  "contextId" TEXT NOT NULL,
  "whistleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserNotification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserNotification_recipientUserId_type_whistleId_key"
  ON "UserNotification"("recipientUserId", "type", "whistleId");
CREATE INDEX "UserNotification_recipientUserId_readAt_createdAt_idx"
  ON "UserNotification"("recipientUserId", "readAt", "createdAt");
CREATE INDEX "UserNotification_actorUserId_createdAt_idx"
  ON "UserNotification"("actorUserId", "createdAt");
CREATE INDEX "UserNotification_contextType_contextId_createdAt_idx"
  ON "UserNotification"("contextType", "contextId", "createdAt");
