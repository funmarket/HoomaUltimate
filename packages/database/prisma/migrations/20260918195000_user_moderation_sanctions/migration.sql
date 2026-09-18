CREATE TYPE "UserSanctionType" AS ENUM (
  'YELLOW_CARD_WARNING',
  'RED_CARD_BAN',
  'TEMPORARY_BAN',
  'READ_ONLY',
  'ACCOUNT_DISABLED'
);

CREATE TABLE "UserSanction" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actionType" "UserSanctionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "clearedByUserId" TEXT,
  "clearReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSanction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserSanction_targetUserId_actionType_clearedAt_expiresAt_idx" ON "UserSanction"("targetUserId", "actionType", "clearedAt", "expiresAt");
CREATE INDEX "UserSanction_targetUserId_createdAt_idx" ON "UserSanction"("targetUserId", "createdAt");
CREATE INDEX "UserSanction_actorUserId_createdAt_idx" ON "UserSanction"("actorUserId", "createdAt");

ALTER TABLE "UserSanction" ADD CONSTRAINT "UserSanction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSanction" ADD CONSTRAINT "UserSanction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserSanction" ADD CONSTRAINT "UserSanction_clearedByUserId_fkey" FOREIGN KEY ("clearedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
