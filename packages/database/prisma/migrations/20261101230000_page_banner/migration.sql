-- CreateEnum
CREATE TYPE "PageBannerDestinationKind" AS ENUM ('INTERNAL', 'EXTERNAL');

CREATE TABLE "PageBannerPlacement" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PageBannerPlacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageBannerSlide" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDecorative" BOOLEAN NOT NULL DEFAULT false,
    "altText" TEXT,
    "destinationKind" "PageBannerDestinationKind",
    "destinationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PageBannerSlide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageBannerSlideVariant" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageBannerSlideVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageBannerSlide_mediaId_key" ON "PageBannerSlide"("mediaId");
CREATE UNIQUE INDEX "PageBannerSlide_placementId_sortOrder_key" ON "PageBannerSlide"("placementId", "sortOrder");
CREATE INDEX "PageBannerSlide_placementId_enabled_sortOrder_idx" ON "PageBannerSlide"("placementId", "enabled", "sortOrder");
CREATE UNIQUE INDEX "PageBannerSlideVariant_slideId_variant_key" ON "PageBannerSlideVariant"("slideId", "variant");
CREATE INDEX "PageBannerSlideVariant_objectKey_idx" ON "PageBannerSlideVariant"("objectKey");

ALTER TABLE "PageBannerSlide" ADD CONSTRAINT "PageBannerSlide_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "PageBannerPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageBannerSlideVariant" ADD CONSTRAINT "PageBannerSlideVariant_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "PageBannerSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PageBannerPlacement" ("id", "enabled", "updatedAt") VALUES
  ('HOME_TOP', false, CURRENT_TIMESTAMP),
  ('PLAY_TOP', false, CURRENT_TIMESTAMP),
  ('WATCH_TOP', false, CURRENT_TIMESTAMP),
  ('HOOMA_TOP', false, CURRENT_TIMESTAMP),
  ('TEAMS_TOP', false, CURRENT_TIMESTAMP),
  ('PITCH_TOP', false, CURRENT_TIMESTAMP),
  ('PLACES_TOP', false, CURRENT_TIMESTAMP),
  ('REQUESTS_TOP', false, CURRENT_TIMESTAMP),
  ('GEAR_UP_TOP', false, CURRENT_TIMESTAMP),
  ('RIDE_TOP', false, CURRENT_TIMESTAMP),
  ('ATHLETES_TOP', false, CURRENT_TIMESTAMP);
