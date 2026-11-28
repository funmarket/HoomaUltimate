ALTER TABLE "Team"
  ADD COLUMN "badgeMediaId" TEXT,
  ADD COLUMN "badgeObjectKey" TEXT,
  ADD COLUMN "badgeContentType" TEXT,
  ADD COLUMN "badgeSizeBytes" INTEGER,
  ADD COLUMN "bannerMediaId" TEXT,
  ADD COLUMN "bannerObjectKey" TEXT,
  ADD COLUMN "bannerContentType" TEXT,
  ADD COLUMN "bannerSizeBytes" INTEGER;

ALTER TABLE "Team" ADD CONSTRAINT "Team_badge_media_source_check" CHECK (
  ("badgeUrl" IS NOT NULL AND "badgeMediaId" IS NULL AND "badgeObjectKey" IS NULL AND "badgeContentType" IS NULL AND "badgeSizeBytes" IS NULL)
  OR ("badgeUrl" IS NULL AND "badgeMediaId" IS NOT NULL AND "badgeObjectKey" IS NOT NULL AND "badgeContentType" = 'image/webp' AND "badgeSizeBytes" > 0)
  OR ("badgeUrl" IS NULL AND "badgeMediaId" IS NULL AND "badgeObjectKey" IS NULL AND "badgeContentType" IS NULL AND "badgeSizeBytes" IS NULL)
);
ALTER TABLE "Team" ADD CONSTRAINT "Team_banner_media_source_check" CHECK (
  ("bannerUrl" IS NOT NULL AND "bannerMediaId" IS NULL AND "bannerObjectKey" IS NULL AND "bannerContentType" IS NULL AND "bannerSizeBytes" IS NULL)
  OR ("bannerUrl" IS NULL AND "bannerMediaId" IS NOT NULL AND "bannerObjectKey" IS NOT NULL AND "bannerContentType" = 'image/webp' AND "bannerSizeBytes" > 0)
  OR ("bannerUrl" IS NULL AND "bannerMediaId" IS NULL AND "bannerObjectKey" IS NULL AND "bannerContentType" IS NULL AND "bannerSizeBytes" IS NULL)
);
CREATE UNIQUE INDEX "Team_badgeMediaId_key" ON "Team"("badgeMediaId");
CREATE UNIQUE INDEX "Team_bannerMediaId_key" ON "Team"("bannerMediaId");
