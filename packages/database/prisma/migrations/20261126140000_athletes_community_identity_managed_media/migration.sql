-- AthletesCommunity alone owns exactly one optional managed logo and one optional managed banner.
-- Existing external URL columns remain untouched; no backfill or external ingestion.
ALTER TABLE "AthletesCommunity"
  ADD COLUMN "logoMediaId" TEXT,
  ADD COLUMN "logoObjectKey" TEXT,
  ADD COLUMN "logoContentType" TEXT,
  ADD COLUMN "logoSizeBytes" INTEGER,
  ADD COLUMN "bannerMediaId" TEXT,
  ADD COLUMN "bannerObjectKey" TEXT,
  ADD COLUMN "bannerContentType" TEXT,
  ADD COLUMN "bannerSizeBytes" INTEGER;

ALTER TABLE "AthletesCommunity"
  ADD CONSTRAINT "AthletesCommunity_logo_source_exclusive_check" CHECK (
    (
      "logoMediaId" IS NULL AND "logoObjectKey" IS NULL AND
      "logoContentType" IS NULL AND "logoSizeBytes" IS NULL
    ) OR (
      "logoMediaId" IS NOT NULL AND "logoObjectKey" IS NOT NULL AND
      "logoContentType" IS NOT NULL AND "logoContentType" = 'image/webp' AND
      "logoSizeBytes" IS NOT NULL AND "logoSizeBytes" > 0 AND "logoUrl" IS NULL
    )
  ),
  ADD CONSTRAINT "AthletesCommunity_banner_source_exclusive_check" CHECK (
    (
      "bannerMediaId" IS NULL AND "bannerObjectKey" IS NULL AND
      "bannerContentType" IS NULL AND "bannerSizeBytes" IS NULL
    ) OR (
      "bannerMediaId" IS NOT NULL AND "bannerObjectKey" IS NOT NULL AND
      "bannerContentType" IS NOT NULL AND "bannerContentType" = 'image/webp' AND
      "bannerSizeBytes" IS NOT NULL AND "bannerSizeBytes" > 0 AND "bannerUrl" IS NULL
    )
  );

CREATE UNIQUE INDEX "AthletesCommunity_logoMediaId_key" ON "AthletesCommunity"("logoMediaId");
CREATE UNIQUE INDEX "AthletesCommunity_logoObjectKey_key" ON "AthletesCommunity"("logoObjectKey");
CREATE UNIQUE INDEX "AthletesCommunity_bannerMediaId_key" ON "AthletesCommunity"("bannerMediaId");
CREATE UNIQUE INDEX "AthletesCommunity_bannerObjectKey_key" ON "AthletesCommunity"("bannerObjectKey");
