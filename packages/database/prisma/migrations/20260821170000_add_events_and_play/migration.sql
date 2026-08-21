CREATE TYPE "EventType" AS ENUM ('PLAY', 'WATCH');
CREATE TYPE "EventStatus" AS ENUM ('PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "EventRsvpStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED');
CREATE TYPE "PlayPitchType" AS ENUM ('FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'FUTSAL', 'STREET', 'OTHER');
CREATE TYPE "EventTeamSide" AS ENUM ('A', 'B');

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
  CONSTRAINT "Event_fee_nonnegative" CHECK ("entryFeeMinor" >= 0),
  CONSTRAINT "Event_time_order" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);
CREATE TABLE "PlayEventDetails" (
  "eventId" TEXT NOT NULL,
  "pitchType" "PlayPitchType" NOT NULL,
  "skillLevel" "SkillLevel" NOT NULL DEFAULT 'MIXED',
  "format" "FootballFormat" NOT NULL,
  CONSTRAINT "PlayEventDetails_pkey" PRIMARY KEY ("eventId")
);
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
CREATE TABLE "EventCheckIn" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EventChatRoom" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "opensAt" TIMESTAMP(3) NOT NULL,
  "closesAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventChatRoom_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventChatRoom_window" CHECK ("closesAt" > "opensAt")
);
CREATE TABLE "EventChatMessage" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX "EventRsvp_eventId_status_waitlistSequence_idx" ON "EventRsvp"("eventId", "status", "waitlistSequence");
CREATE INDEX "EventRsvp_userId_status_idx" ON "EventRsvp"("userId", "status");
CREATE INDEX "Event_type_status_startsAt_id_idx" ON "Event"("type", "status", "startsAt", "id");
CREATE INDEX "Event_communityId_type_status_startsAt_idx" ON "Event"("communityId", "type", "status", "startsAt");
CREATE INDEX "Event_createdByUserId_idx" ON "Event"("createdByUserId");
CREATE INDEX "Formation_eventId_updatedAt_idx" ON "Formation"("eventId", "updatedAt");
CREATE INDEX "FormationSlot_formationId_team_idx" ON "FormationSlot"("formationId", "team");
CREATE INDEX "FormationSlot_userId_idx" ON "FormationSlot"("userId");
CREATE UNIQUE INDEX "EventCheckIn_eventId_userId_key" ON "EventCheckIn"("eventId", "userId");
CREATE INDEX "EventCheckIn_userId_createdAt_idx" ON "EventCheckIn"("userId", "createdAt");
CREATE UNIQUE INDEX "EventChatRoom_eventId_key" ON "EventChatRoom"("eventId");
CREATE INDEX "EventChatRoom_closesAt_idx" ON "EventChatRoom"("closesAt");
CREATE INDEX "EventChatMessage_roomId_createdAt_id_idx" ON "EventChatMessage"("roomId", "createdAt", "id");
CREATE INDEX "EventChatMessage_expiresAt_idx" ON "EventChatMessage"("expiresAt");

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
