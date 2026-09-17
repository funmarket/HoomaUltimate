CREATE TYPE "HelpAudienceScope" AS ENUM ('PUBLIC', 'HOOMA_COMMUNITY', 'ATHLETES_COMMUNITY');
CREATE TYPE "HelpCategory" AS ENUM ('PEOPLE', 'ITEM', 'PLACE', 'TRANSPORT', 'SERVICE', 'EDUCATION', 'COMMUNITY', 'OTHER');
CREATE TYPE "HelpItemKind" AS ENUM ('FOOTWEAR', 'CLOTHING', 'SPORTS_GEAR', 'BOOKS', 'EQUIPMENT', 'SCHOOL_SUPPLIES', 'HOUSEHOLD', 'BIKE', 'OTHER');
CREATE TYPE "RequestConditionPreference" AS ENUM ('ANY', 'NEW_ONLY', 'USED_OK');
CREATE TYPE "HelpRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "publisherCommunityId" TEXT,
    "publisherTeamId" TEXT,
    "publisherAthletesCommunityId" TEXT,
    "audienceScope" "HelpAudienceScope" NOT NULL,
    "audienceCommunityId" TEXT,
    "audienceAthletesCommunityId" TEXT,
    "category" "HelpCategory" NOT NULL,
    "itemKind" "HelpItemKind",
    "sport" "AthletesSport",
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityNeeded" INTEGER,
    "sizeLabel" TEXT,
    "conditionPreference" "RequestConditionPreference",
    "placeId" TEXT,
    "city" TEXT,
    "houma" TEXT,
    "locationNote" TEXT,
    "neededByAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'OPEN',
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HelpRequest_publisher_strategy_check" CHECK (num_nonnulls("publisherCommunityId", "publisherTeamId", "publisherAthletesCommunityId") <= 1),
    CONSTRAINT "HelpRequest_audience_strategy_check" CHECK (
      ("audienceScope" = 'PUBLIC' AND "audienceCommunityId" IS NULL AND "audienceAthletesCommunityId" IS NULL)
      OR ("audienceScope" = 'HOOMA_COMMUNITY' AND "audienceCommunityId" IS NOT NULL AND "audienceAthletesCommunityId" IS NULL)
      OR ("audienceScope" = 'ATHLETES_COMMUNITY' AND "audienceCommunityId" IS NULL AND "audienceAthletesCommunityId" IS NOT NULL)
    ),
    CONSTRAINT "HelpRequest_title_length_check" CHECK (char_length(btrim("title")) BETWEEN 3 AND 120),
    CONSTRAINT "HelpRequest_description_length_check" CHECK (char_length(btrim("description")) BETWEEN 10 AND 1200),
    CONSTRAINT "HelpRequest_quantity_positive_check" CHECK ("quantityNeeded" IS NULL OR "quantityNeeded" > 0)
);

CREATE INDEX "HelpRequest_status_createdAt_id_idx" ON "HelpRequest"("status", "createdAt", "id");
CREATE INDEX "HelpRequest_audienceScope_status_createdAt_idx" ON "HelpRequest"("audienceScope", "status", "createdAt");
CREATE INDEX "HelpRequest_audienceCommunityId_status_createdAt_idx" ON "HelpRequest"("audienceCommunityId", "status", "createdAt");
CREATE INDEX "HelpRequest_audienceAthletesCommunityId_status_createdAt_idx" ON "HelpRequest"("audienceAthletesCommunityId", "status", "createdAt");
CREATE INDEX "HelpRequest_createdByUserId_status_createdAt_idx" ON "HelpRequest"("createdByUserId", "status", "createdAt");
CREATE INDEX "HelpRequest_publisherCommunityId_status_createdAt_idx" ON "HelpRequest"("publisherCommunityId", "status", "createdAt");
CREATE INDEX "HelpRequest_publisherTeamId_status_createdAt_idx" ON "HelpRequest"("publisherTeamId", "status", "createdAt");
CREATE INDEX "HelpRequest_publisherAthletesCommunityId_status_createdAt_idx" ON "HelpRequest"("publisherAthletesCommunityId", "status", "createdAt");
CREATE INDEX "HelpRequest_category_status_createdAt_idx" ON "HelpRequest"("category", "status", "createdAt");
CREATE INDEX "HelpRequest_sport_status_createdAt_idx" ON "HelpRequest"("sport", "status", "createdAt");
CREATE INDEX "HelpRequest_expiresAt_status_idx" ON "HelpRequest"("expiresAt", "status");

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_publisherCommunityId_fkey"
FOREIGN KEY ("publisherCommunityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_publisherTeamId_fkey"
FOREIGN KEY ("publisherTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_publisherAthletesCommunityId_fkey"
FOREIGN KEY ("publisherAthletesCommunityId") REFERENCES "AthletesCommunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_audienceCommunityId_fkey"
FOREIGN KEY ("audienceCommunityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_audienceAthletesCommunityId_fkey"
FOREIGN KEY ("audienceAthletesCommunityId") REFERENCES "AthletesCommunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_placeId_fkey"
FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
