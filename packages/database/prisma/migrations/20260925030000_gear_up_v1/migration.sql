CREATE TYPE "PlaceDiscoveryKind" AS ENUM ('WATCH_SPOT', 'GEAR_UP');
CREATE TYPE "GearUpOfferType" AS ENUM ('SPORTSWEAR', 'GEAR');
CREATE TYPE "GearUpProductCategory" AS ENUM (
  'JERSEYS_KITS',
  'TRAINING_WEAR',
  'TOPS',
  'SPORTS_BOTTOMS',
  'TRACKSUITS',
  'FOOTWEAR_BOOTS',
  'FANWEAR',
  'BALLS',
  'GOALKEEPER_GEAR',
  'PROTECTIVE_GEAR',
  'TRAINING_EQUIPMENT',
  'BAGS',
  'GYM_EQUIPMENT',
  'CYCLING_GEAR',
  'ACCESSORIES',
  'OTHER'
);
CREATE TYPE "GearUpProductImageSource" AS ENUM ('UPLOAD', 'EXTERNAL_URL');

CREATE TABLE "PlaceDiscovery" (
  "placeId" TEXT NOT NULL,
  "kind" "PlaceDiscoveryKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceDiscovery_pkey" PRIMARY KEY ("placeId", "kind")
);

CREATE TABLE "GearUpShop" (
  "placeId" TEXT NOT NULL,
  "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "offerTypes" "GearUpOfferType"[],
  "sports" "AthletesSport"[],
  "categories" "GearUpProductCategory"[],
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearUpShop_pkey" PRIMARY KEY ("placeId")
);

CREATE TABLE "GearUpProduct" (
  "id" TEXT NOT NULL,
  "shopPlaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "brand" TEXT,
  "description" TEXT NOT NULL,
  "sports" "AthletesSport"[],
  "category" "GearUpProductCategory" NOT NULL,
  "price" DECIMAL(10,3),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'TND',
  "featuredAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearUpProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GearUpProductImage" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "source" "GearUpProductImageSource" NOT NULL,
  "objectKey" TEXT,
  "externalUrl" TEXT,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearUpProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GearUpSettings" (
  "id" TEXT NOT NULL,
  "productImageLimit" INTEGER NOT NULL DEFAULT 3,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GearUpSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlaceDiscovery_kind_createdAt_idx" ON "PlaceDiscovery"("kind", "createdAt");
CREATE INDEX "GearUpShop_moderationStatus_updatedAt_idx" ON "GearUpShop"("moderationStatus", "updatedAt");
CREATE INDEX "GearUpProduct_shopPlaceId_archivedAt_featuredAt_idx" ON "GearUpProduct"("shopPlaceId", "archivedAt", "featuredAt");
CREATE INDEX "GearUpProduct_category_archivedAt_idx" ON "GearUpProduct"("category", "archivedAt");
CREATE UNIQUE INDEX "GearUpProductImage_objectKey_key" ON "GearUpProductImage"("objectKey");
CREATE UNIQUE INDEX "GearUpProductImage_productId_sortOrder_key" ON "GearUpProductImage"("productId", "sortOrder");
CREATE INDEX "GearUpProductImage_productId_sortOrder_idx" ON "GearUpProductImage"("productId", "sortOrder");

ALTER TABLE "PlaceDiscovery"
  ADD CONSTRAINT "PlaceDiscovery_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearUpShop"
  ADD CONSTRAINT "GearUpShop_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearUpProduct"
  ADD CONSTRAINT "GearUpProduct_shopPlaceId_fkey"
  FOREIGN KEY ("shopPlaceId") REFERENCES "GearUpShop"("placeId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearUpProductImage"
  ADD CONSTRAINT "GearUpProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "GearUpProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlaceDiscovery" ("placeId", "kind", "createdAt")
SELECT p."id", 'WATCH_SPOT', CURRENT_TIMESTAMP
FROM "Place" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "PlaceCapability" pc
  WHERE pc."placeId" = p."id"
    AND pc."kind" = 'PITCH'
)
ON CONFLICT ("placeId", "kind") DO NOTHING;

INSERT INTO "GearUpSettings" ("id", "productImageLimit", "updatedAt")
VALUES ('default', 3, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
