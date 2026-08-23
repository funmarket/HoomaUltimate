-- HOOMA pre-release clean initial migration.
-- Generated from the canonical Prisma schema with Prisma 6.19.3 using
-- migrate diff --from-empty, then manually reviewed for PostgreSQL-only
-- invariants required by the active normalization plan.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('FOUNDER', 'COACH', 'MEMBER');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeamResponsibilityRole" AS ENUM ('COACH', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "TeamCapability" AS ENUM ('EDIT_TEAM', 'MANAGE_ROSTER', 'MANAGE_LINEUP', 'CREATE_CHALLENGE', 'RESPOND_TO_CHALLENGE', 'MANAGE_TEAM_EVENTS');

-- CreateEnum
CREATE TYPE "TeamChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamGameStatus" AS ENUM ('SCHEDULING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FootballFormat" AS ENUM ('FIVE_V_FIVE', 'SIX_V_SIX', 'SEVEN_V_SEVEN', 'EIGHT_V_EIGHT', 'NINE_V_NINE', 'ELEVEN_V_ELEVEN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PLAY', 'WATCH');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventRsvpStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED');

-- CreateEnum
CREATE TYPE "PlayPitchType" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'FUTSAL', 'STREET', 'OTHER');

-- CreateEnum
CREATE TYPE "EventTeamSide" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPresentation" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPresentation_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TelegramIdentity" (
    "userId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "photoUrl" TEXT,
    "languageCode" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WebCredential" (
    "userId" TEXT NOT NULL,
    "loginUsername" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "CommunityMembership" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" INTEGER,
    "positions" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    CONSTRAINT "TeamPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamResponsibilityAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamResponsibilityRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "TeamResponsibilityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCapabilityGrant" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capability" "TeamCapability" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "TeamCapabilityGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLineup" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "matchFormat" "FootballFormat" NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "userId" TEXT,
    "position" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeamLineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "TeamChallengeMessage" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamChallengeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
    "venueName" TEXT,
    "address" TEXT,
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "entryFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Event_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0),
    CONSTRAINT "Event_entry_fee_nonnegative" CHECK ("entryFeeMinor" >= 0),
    CONSTRAINT "Event_end_after_start" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

-- CreateTable
CREATE TABLE "PlayEventDetails" (
    "eventId" TEXT NOT NULL,
    "pitchType" "PlayPitchType" NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'MIXED',
    "format" "FootballFormat" NOT NULL,
    CONSTRAINT "PlayEventDetails_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'CONFIRMED',
    "waitlistSequence" BIGINT,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "FootballFormat" NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationSlot" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "userId" TEXT,
    "team" "EventTeamSide" NOT NULL,
    "position" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "FormationSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FormationSlot_x_range" CHECK ("x" >= 0 AND "x" <= 100),
    CONSTRAINT "FormationSlot_y_range" CHECK ("y" >= 0 AND "y" <= 100)
);

-- CreateTable
CREATE TABLE "EventCheckIn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventCheckIn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventCheckIn_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
    CONSTRAINT "EventCheckIn_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180))
);

-- CreateTable
CREATE TABLE "EventChatRoom" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventChatRoom_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventChatRoom_valid_window" CHECK ("closesAt" > "opensAt")
);

-- CreateTable
CREATE TABLE "EventChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventChatMessage_expiry_after_creation" CHECK ("expiresAt" > "createdAt")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPresentation_username_key" ON "UserPresentation"("username");
CREATE UNIQUE INDEX "TelegramIdentity_telegramUserId_key" ON "TelegramIdentity"("telegramUserId");
CREATE UNIQUE INDEX "WebCredential_loginUsername_key" ON "WebCredential"("loginUsername");
CREATE UNIQUE INDEX "WebCredential_email_key" ON "WebCredential"("email");
CREATE UNIQUE INDEX "WebSession_tokenHash_key" ON "WebSession"("tokenHash");
CREATE INDEX "WebSession_userId_expiresAt_idx" ON "WebSession"("userId", "expiresAt");
CREATE INDEX "WebSession_expiresAt_revokedAt_idx" ON "WebSession"("expiresAt", "revokedAt");
CREATE INDEX "PlatformRoleAssignment_role_revokedAt_idx" ON "PlatformRoleAssignment"("role", "revokedAt");
CREATE UNIQUE INDEX "PlatformRoleAssignment_userId_role_key" ON "PlatformRoleAssignment"("userId", "role");
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");
CREATE INDEX "Community_status_createdAt_idx" ON "Community"("status", "createdAt");
CREATE INDEX "Community_city_houma_idx" ON "Community"("city", "houma");
CREATE INDEX "CommunityMembership_userId_role_leftAt_idx" ON "CommunityMembership"("userId", "role", "leftAt");
CREATE UNIQUE INDEX "CommunityMembership_communityId_userId_key" ON "CommunityMembership"("communityId", "userId");
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
CREATE INDEX "Team_status_createdAt_idx" ON "Team"("status", "createdAt");
CREATE INDEX "Team_communityId_status_idx" ON "Team"("communityId", "status");
CREATE INDEX "Team_city_houma_idx" ON "Team"("city", "houma");
CREATE UNIQUE INDEX "Team_one_active_per_community_key" ON "Team"("communityId") WHERE "status" = 'ACTIVE' AND "communityId" IS NOT NULL;
CREATE INDEX "TeamPlayer_teamId_active_idx" ON "TeamPlayer"("teamId", "active");
CREATE INDEX "TeamPlayer_userId_active_idx" ON "TeamPlayer"("userId", "active");
CREATE UNIQUE INDEX "TeamPlayer_teamId_userId_key" ON "TeamPlayer"("teamId", "userId");
CREATE INDEX "TeamResponsibilityAssignment_teamId_role_revokedAt_idx" ON "TeamResponsibilityAssignment"("teamId", "role", "revokedAt");
CREATE INDEX "TeamResponsibilityAssignment_userId_role_revokedAt_idx" ON "TeamResponsibilityAssignment"("userId", "role", "revokedAt");
CREATE INDEX "TeamCapabilityGrant_teamId_userId_revokedAt_idx" ON "TeamCapabilityGrant"("teamId", "userId", "revokedAt");
CREATE UNIQUE INDEX "TeamCapabilityGrant_teamId_userId_capability_key" ON "TeamCapabilityGrant"("teamId", "userId", "capability");
CREATE INDEX "TeamLineup_teamId_published_active_updatedAt_idx" ON "TeamLineup"("teamId", "published", "active", "updatedAt");
CREATE INDEX "TeamLineupSlot_lineupId_sortOrder_idx" ON "TeamLineupSlot"("lineupId", "sortOrder");
CREATE INDEX "TeamChallenge_challengerTeamId_status_createdAt_idx" ON "TeamChallenge"("challengerTeamId", "status", "createdAt");
CREATE INDEX "TeamChallenge_challengedTeamId_status_createdAt_idx" ON "TeamChallenge"("challengedTeamId", "status", "createdAt");
CREATE UNIQUE INDEX "TeamChallenge_one_pending_unordered_pair_key" ON "TeamChallenge" (LEAST("challengerTeamId", "challengedTeamId"), GREATEST("challengerTeamId", "challengedTeamId")) WHERE "status" = 'PENDING';
CREATE INDEX "TeamChallengeMessage_challengeId_createdAt_idx" ON "TeamChallengeMessage"("challengeId", "createdAt");
CREATE UNIQUE INDEX "TeamGame_challengeId_key" ON "TeamGame"("challengeId");
CREATE INDEX "TeamGame_homeTeamId_scheduledAt_idx" ON "TeamGame"("homeTeamId", "scheduledAt");
CREATE INDEX "TeamGame_awayTeamId_scheduledAt_idx" ON "TeamGame"("awayTeamId", "scheduledAt");
CREATE INDEX "Event_type_status_startsAt_id_idx" ON "Event"("type", "status", "startsAt", "id");
CREATE INDEX "Event_communityId_type_status_startsAt_idx" ON "Event"("communityId", "type", "status", "startsAt");
CREATE INDEX "Event_createdByUserId_idx" ON "Event"("createdByUserId");
CREATE INDEX "EventRsvp_eventId_status_waitlistSequence_idx" ON "EventRsvp"("eventId", "status", "waitlistSequence");
CREATE INDEX "EventRsvp_userId_status_idx" ON "EventRsvp"("userId", "status");
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX "Formation_eventId_updatedAt_idx" ON "Formation"("eventId", "updatedAt");
CREATE INDEX "FormationSlot_formationId_team_idx" ON "FormationSlot"("formationId", "team");
CREATE INDEX "FormationSlot_userId_idx" ON "FormationSlot"("userId");
CREATE INDEX "EventCheckIn_userId_createdAt_idx" ON "EventCheckIn"("userId", "createdAt");
CREATE UNIQUE INDEX "EventCheckIn_eventId_userId_key" ON "EventCheckIn"("eventId", "userId");
CREATE UNIQUE INDEX "EventChatRoom_eventId_key" ON "EventChatRoom"("eventId");
CREATE INDEX "EventChatRoom_closesAt_idx" ON "EventChatRoom"("closesAt");
CREATE INDEX "EventChatMessage_roomId_createdAt_id_idx" ON "EventChatMessage"("roomId", "createdAt", "id");
CREATE INDEX "EventChatMessage_expiresAt_idx" ON "EventChatMessage"("expiresAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "UserPresentation" ADD CONSTRAINT "UserPresentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramIdentity" ADD CONSTRAINT "TelegramIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebCredential" ADD CONSTRAINT "WebCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
ALTER TABLE "TeamCapabilityGrant" ADD CONSTRAINT "TeamCapabilityGrant_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
ALTER TABLE "Event" ADD CONSTRAINT "Event_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayEventDetails" ADD CONSTRAINT "PlayEventDetails_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormationSlot" ADD CONSTRAINT "FormationSlot_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormationSlot" ADD CONSTRAINT "FormationSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventChatRoom" ADD CONSTRAINT "EventChatRoom_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "EventChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
