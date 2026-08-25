-- Global delegated management remains separate from the full PLATFORM_ADMIN owner role.
CREATE TYPE "AppManagerCapability" AS ENUM (
  'REVIEW_PLACES',
  'REVIEW_PLACE_OWNERSHIP',
  'REVIEW_WATCH_APPLICATIONS',
  'REVIEW_PITCH_APPLICATIONS',
  'MODERATE_CONTENT',
  'MANAGE_GAMER_CATALOG',
  'MANAGE_FOOTBALL_CATALOG',
  'VIEW_AUDIT'
);

CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PlaceCapabilityKind" AS ENUM ('WATCH', 'PITCH');

CREATE TABLE "AppManagerGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" "AppManagerCapability" NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AppManagerGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Place" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT,
  "houma" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "phone" TEXT,
  "websiteUrl" TEXT,
  "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "suggestedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaceOwnershipClaim" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "claimantUserId" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaceOwnershipClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaceOwnership" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verifiedByUserId" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PlaceOwnership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaceCapabilityApplication" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "kind" "PlaceCapabilityKind" NOT NULL,
  "summary" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaceCapabilityApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppManagerGrant_userId_capability_key" ON "AppManagerGrant"("userId", "capability");
CREATE INDEX "AppManagerGrant_userId_revokedAt_idx" ON "AppManagerGrant"("userId", "revokedAt");
CREATE INDEX "AppManagerGrant_capability_revokedAt_idx" ON "AppManagerGrant"("capability", "revokedAt");

CREATE UNIQUE INDEX "Place_slug_key" ON "Place"("slug");
CREATE INDEX "Place_moderationStatus_createdAt_idx" ON "Place"("moderationStatus", "createdAt");
CREATE INDEX "Place_city_houma_idx" ON "Place"("city", "houma");

CREATE UNIQUE INDEX "PlaceOwnershipClaim_placeId_claimantUserId_key" ON "PlaceOwnershipClaim"("placeId", "claimantUserId");
CREATE INDEX "PlaceOwnershipClaim_status_createdAt_idx" ON "PlaceOwnershipClaim"("status", "createdAt");
CREATE INDEX "PlaceOwnershipClaim_claimantUserId_status_idx" ON "PlaceOwnershipClaim"("claimantUserId", "status");

CREATE UNIQUE INDEX "PlaceOwnership_placeId_userId_key" ON "PlaceOwnership"("placeId", "userId");
CREATE INDEX "PlaceOwnership_userId_revokedAt_idx" ON "PlaceOwnership"("userId", "revokedAt");
CREATE INDEX "PlaceOwnership_placeId_revokedAt_idx" ON "PlaceOwnership"("placeId", "revokedAt");

CREATE UNIQUE INDEX "PlaceCapabilityApplication_placeId_kind_key" ON "PlaceCapabilityApplication"("placeId", "kind");
CREATE INDEX "PlaceCapabilityApplication_kind_status_createdAt_idx" ON "PlaceCapabilityApplication"("kind", "status", "createdAt");
CREATE INDEX "PlaceCapabilityApplication_applicantUserId_status_idx" ON "PlaceCapabilityApplication"("applicantUserId", "status");

ALTER TABLE "AppManagerGrant"
  ADD CONSTRAINT "AppManagerGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppManagerGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Place"
  ADD CONSTRAINT "Place_suggestedByUserId_fkey" FOREIGN KEY ("suggestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlaceOwnershipClaim"
  ADD CONSTRAINT "PlaceOwnershipClaim_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlaceOwnershipClaim_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceOwnership"
  ADD CONSTRAINT "PlaceOwnership_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlaceOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceCapabilityApplication"
  ADD CONSTRAINT "PlaceCapabilityApplication_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlaceCapabilityApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
