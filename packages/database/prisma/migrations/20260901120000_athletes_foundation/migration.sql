-- Athletes foundation domain: independent HOOMA-connected sports communities.
CREATE TYPE "AthletesSport" AS ENUM ('CYCLING', 'RUNNING', 'SWIMMING', 'FOOTBALL', 'BASKETBALL', 'TENNIS', 'PADEL', 'GYM_FITNESS', 'OTHER');
CREATE TYPE "AthletesCommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AthletesVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "AthletesJoinPolicy" AS ENUM ('OPEN', 'APPROVAL_REQUIRED');
CREATE TYPE "AthletesRole" AS ENUM ('FOUNDER', 'MODERATOR', 'MEMBER');
CREATE TYPE "AthletesJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

CREATE TABLE "AthletesCommunity" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sport" "AthletesSport" NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "houma" TEXT,
  "logoUrl" TEXT,
  "bannerUrl" TEXT,
  "visibility" "AthletesVisibility" NOT NULL DEFAULT 'PUBLIC',
  "joinPolicy" "AthletesJoinPolicy" NOT NULL DEFAULT 'OPEN',
  "status" "AthletesCommunityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthletesCommunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AthletesMembership" (
  "id" TEXT NOT NULL,
  "athletesCommunityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AthletesRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "AthletesMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AthletesJoinRequest" (
  "id" TEXT NOT NULL,
  "athletesCommunityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AthletesJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthletesJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AthletesCommunity_slug_key" ON "AthletesCommunity"("slug");
CREATE INDEX "AthletesCommunity_status_sport_createdAt_id_idx" ON "AthletesCommunity"("status", "sport", "createdAt", "id");
CREATE INDEX "AthletesCommunity_city_houma_idx" ON "AthletesCommunity"("city", "houma");
CREATE INDEX "AthletesCommunity_createdByUserId_status_idx" ON "AthletesCommunity"("createdByUserId", "status");
CREATE UNIQUE INDEX "AthletesMembership_one_active_per_user_community" ON "AthletesMembership"("athletesCommunityId", "userId") WHERE "leftAt" IS NULL;
CREATE INDEX "AthletesMembership_userId_role_leftAt_idx" ON "AthletesMembership"("userId", "role", "leftAt");
CREATE INDEX "AthletesMembership_athletesCommunityId_role_leftAt_idx" ON "AthletesMembership"("athletesCommunityId", "role", "leftAt");
CREATE INDEX "AthletesJoinRequest_athletesCommunityId_status_requestedAt_idx" ON "AthletesJoinRequest"("athletesCommunityId", "status", "requestedAt");
CREATE INDEX "AthletesJoinRequest_userId_status_requestedAt_idx" ON "AthletesJoinRequest"("userId", "status", "requestedAt");
CREATE UNIQUE INDEX "AthletesJoinRequest_one_pending_per_user_community" ON "AthletesJoinRequest"("athletesCommunityId", "userId") WHERE "status" = 'PENDING';

ALTER TABLE "AthletesCommunity" ADD CONSTRAINT "AthletesCommunity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletesMembership" ADD CONSTRAINT "AthletesMembership_athletesCommunityId_fkey" FOREIGN KEY ("athletesCommunityId") REFERENCES "AthletesCommunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletesMembership" ADD CONSTRAINT "AthletesMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletesJoinRequest" ADD CONSTRAINT "AthletesJoinRequest_athletesCommunityId_fkey" FOREIGN KEY ("athletesCommunityId") REFERENCES "AthletesCommunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletesJoinRequest" ADD CONSTRAINT "AthletesJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletesJoinRequest" ADD CONSTRAINT "AthletesJoinRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
