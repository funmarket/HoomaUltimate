-- Community-scoped RideRequests persist exact HOOMA audience targets.
CREATE TYPE "RideRequestAudienceScope" AS ENUM ('GLOBAL', 'COMMUNITY');

ALTER TABLE "RideRequest"
  ADD COLUMN "audienceScope" "RideRequestAudienceScope" NOT NULL DEFAULT 'GLOBAL';

CREATE TABLE "RideRequestCommunityAudience" (
  "rideRequestId" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RideRequestCommunityAudience_pkey" PRIMARY KEY ("rideRequestId", "communityId")
);

CREATE INDEX "RideRequest_audienceScope_status_expiresAt_idx"
  ON "RideRequest"("audienceScope", "status", "expiresAt");

CREATE INDEX "RideRequestCommunityAudience_communityId_rideRequestId_idx"
  ON "RideRequestCommunityAudience"("communityId", "rideRequestId");

ALTER TABLE "RideRequestCommunityAudience"
  ADD CONSTRAINT "RideRequestCommunityAudience_rideRequestId_fkey"
  FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideRequestCommunityAudience"
  ADD CONSTRAINT "RideRequestCommunityAudience_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
