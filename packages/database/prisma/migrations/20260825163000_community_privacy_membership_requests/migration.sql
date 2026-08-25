CREATE TYPE "CommunityVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "CommunityJoinPolicy" AS ENUM ('OPEN', 'APPROVAL_REQUIRED');
CREATE TYPE "CommunityJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

ALTER TABLE "Community"
ADD COLUMN "visibility" "CommunityVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "joinPolicy" "CommunityJoinPolicy" NOT NULL DEFAULT 'OPEN';

CREATE TABLE "CommunityJoinRequest" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CommunityJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityJoinRequest_pkey" PRIMARY KEY ("id")
);

DROP INDEX "Community_status_createdAt_idx";
CREATE INDEX "Community_status_visibility_createdAt_idx"
ON "Community"("status", "visibility", "createdAt");

CREATE UNIQUE INDEX "CommunityJoinRequest_communityId_userId_key"
ON "CommunityJoinRequest"("communityId", "userId");
CREATE INDEX "CommunityJoinRequest_communityId_status_requestedAt_idx"
ON "CommunityJoinRequest"("communityId", "status", "requestedAt");
CREATE INDEX "CommunityJoinRequest_userId_status_requestedAt_idx"
ON "CommunityJoinRequest"("userId", "status", "requestedAt");

ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_communityId_fkey"
FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityJoinRequest"
ADD CONSTRAINT "CommunityJoinRequest_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
