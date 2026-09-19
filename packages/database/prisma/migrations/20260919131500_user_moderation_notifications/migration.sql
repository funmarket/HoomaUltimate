ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_YELLOW_CARD';
ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_SECOND_YELLOW_CARD';
ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_RED_CARD_BAN';
ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_TEMPORARY_BAN';
ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_READ_ONLY';
ALTER TYPE "UserNotificationType" ADD VALUE 'MODERATION_ACCOUNT_DISABLED';

ALTER TABLE "UserNotification"
  ALTER COLUMN "whistleId" DROP NOT NULL,
  ADD COLUMN "sanctionId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "UserNotification_recipientUserId_type_sanctionId_key"
  ON "UserNotification"("recipientUserId", "type", "sanctionId");
