CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CommunityRole" AS ENUM ('FOUNDER', 'COACH', 'MEMBER');
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TeamResponsibilityRole" AS ENUM ('COACH', 'ASSISTANT');
CREATE TYPE "TeamCapability" AS ENUM ('EDIT_TEAM', 'MANAGE_ROSTER', 'MANAGE_LINEUP', 'CREATE_CHALLENGE', 'RESPOND_TO_CHALLENGE', 'MANAGE_TEAM_EVENTS');
CREATE TYPE "TeamChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE "TeamGameStatus" AS ENUM ('SCHEDULING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FootballFormat" AS ENUM ('FIVE_V_FIVE', 'SIX_V_SIX', 'SEVEN_V_SEVEN', 'EIGHT_V_EIGHT', 'NINE_V_NINE', 'ELEVEN_V_ELEVEN');

CREATE TABLE "Community" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "houma" TEXT,
  "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommunityMembership" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "communityId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "motto" TEXT,
  "city" TEXT,
  "houma" TEXT,
  "badgeUrl" TEXT,
  "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamPlayer" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamResponsibilityAssignment" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TeamResponsibilityRole" NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "TeamResponsibilityAssignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamCapabilityGrant" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" "TeamCapability" NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "TeamCapabilityGrant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamLineup" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "formation" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamLineup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamLineupSlot" (
  "id" TEXT NOT NULL,
  "lineupId" TEXT NOT NULL,
  "userId" TEXT,
  "position" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TeamLineupSlot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamChallenge" (
  "id" TEXT NOT NULL,
  "challengerTeamId" TEXT NOT NULL,
  "challengedTeamId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "format" "FootballFormat" NOT NULL,
  "proposedAt" TIMESTAMP(3),
  "message" TEXT,
  "status" "TeamChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamChallenge_different_teams" CHECK ("challengerTeamId" <> "challengedTeamId")
);
CREATE TABLE "TeamChallengeMessage" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamChallengeMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TeamGame" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "homeTeamId" TEXT NOT NULL,
  "awayTeamId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "status" "TeamGameStatus" NOT NULL DEFAULT 'SCHEDULING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamGame_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamGame_different_teams" CHECK ("homeTeamId" <> "awayTeamId")
);

CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");
CREATE INDEX "Community_status_createdAt_idx" ON "Community"("status", "createdAt");
CREATE INDEX "Community_city_houma_idx" ON "Community"("city", "houma");
CREATE UNIQUE INDEX "CommunityMembership_communityId_userId_key" ON "CommunityMembership"("communityId", "userId");
CREATE INDEX "CommunityMembership_userId_role_leftAt_idx" ON "CommunityMembership"("userId", "role", "leftAt");
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
CREATE INDEX "Team_status_createdAt_idx" ON "Team"("status", "createdAt");
CREATE INDEX "Team_communityId_status_idx" ON "Team"("communityId", "status");
CREATE INDEX "Team_city_houma_idx" ON "Team"("city", "houma");
CREATE UNIQUE INDEX "TeamPlayer_teamId_userId_key" ON "TeamPlayer"("teamId", "userId");
CREATE INDEX "TeamPlayer_userId_leftAt_idx" ON "TeamPlayer"("userId", "leftAt");
CREATE UNIQUE INDEX "TeamResponsibilityAssignment_teamId_userId_role_key" ON "TeamResponsibilityAssignment"("teamId", "userId", "role");
CREATE INDEX "TeamResponsibilityAssignment_userId_role_revokedAt_idx" ON "TeamResponsibilityAssignment"("userId", "role", "revokedAt");
CREATE UNIQUE INDEX "TeamCapabilityGrant_teamId_userId_capability_key" ON "TeamCapabilityGrant"("teamId", "userId", "capability");
CREATE INDEX "TeamCapabilityGrant_userId_revokedAt_idx" ON "TeamCapabilityGrant"("userId", "revokedAt");
CREATE INDEX "TeamLineup_teamId_updatedAt_idx" ON "TeamLineup"("teamId", "updatedAt");
CREATE UNIQUE INDEX "TeamLineupSlot_lineupId_position_sortOrder_key" ON "TeamLineupSlot"("lineupId", "position", "sortOrder");
CREATE INDEX "TeamLineupSlot_userId_idx" ON "TeamLineupSlot"("userId");
CREATE INDEX "TeamChallenge_challengerTeamId_status_createdAt_idx" ON "TeamChallenge"("challengerTeamId", "status", "createdAt");
CREATE INDEX "TeamChallenge_challengedTeamId_status_createdAt_idx" ON "TeamChallenge"("challengedTeamId", "status", "createdAt");
CREATE INDEX "TeamChallengeMessage_challengeId_createdAt_idx" ON "TeamChallengeMessage"("challengeId", "createdAt");
CREATE UNIQUE INDEX "TeamGame_challengeId_key" ON "TeamGame"("challengeId");
CREATE INDEX "TeamGame_homeTeamId_scheduledAt_idx" ON "TeamGame"("homeTeamId", "scheduledAt");
CREATE INDEX "TeamGame_awayTeamId_scheduledAt_idx" ON "TeamGame"("awayTeamId", "scheduledAt");

ALTER TABLE "Community" ADD CONSTRAINT "Community_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamPlayer" ADD CONSTRAINT "TeamPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamResponsibilityAssignment" ADD CONSTRAINT "TeamResponsibilityAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamResponsibilityAssignment" ADD CONSTRAINT "TeamResponsibilityAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamCapabilityGrant" ADD CONSTRAINT "TeamCapabilityGrant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamCapabilityGrant" ADD CONSTRAINT "TeamCapabilityGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamCapabilityGrant" ADD CONSTRAINT "TeamCapabilityGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamLineup" ADD CONSTRAINT "TeamLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamLineup" ADD CONSTRAINT "TeamLineup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamLineupSlot" ADD CONSTRAINT "TeamLineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "TeamLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamLineupSlot" ADD CONSTRAINT "TeamLineupSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamChallenge" ADD CONSTRAINT "TeamChallenge_challengerTeamId_fkey" FOREIGN KEY ("challengerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChallenge" ADD CONSTRAINT "TeamChallenge_challengedTeamId_fkey" FOREIGN KEY ("challengedTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChallenge" ADD CONSTRAINT "TeamChallenge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamChallengeMessage" ADD CONSTRAINT "TeamChallengeMessage_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TeamChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChallengeMessage" ADD CONSTRAINT "TeamChallengeMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "TeamChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
