CREATE TYPE "WatchCulturalCategory" AS ENUM (
  'MUSIC',
  'CONCERT',
  'COMEDY',
  'ART',
  'SCREENING',
  'FOOD',
  'COMMUNITY',
  'OTHER'
);

CREATE TABLE "WatchCulturalEventDetails" (
  "eventId" TEXT NOT NULL,
  "culturalCategory" "WatchCulturalCategory" NOT NULL,
  "imageUrl" TEXT,

  CONSTRAINT "WatchCulturalEventDetails_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "PlaceImage" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlaceImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceImage_placeId_sortOrder_key" ON "PlaceImage"("placeId", "sortOrder");
CREATE INDEX "PlaceImage_placeId_sortOrder_idx" ON "PlaceImage"("placeId", "sortOrder");

ALTER TABLE "WatchCulturalEventDetails"
  ADD CONSTRAINT "WatchCulturalEventDetails_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaceImage"
  ADD CONSTRAINT "PlaceImage_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlaceImage" ("id", "placeId", "imageUrl", "sortOrder", "createdAt", "updatedAt")
SELECT 'legacy-' || "id", "id", "imageUrl", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Place"
WHERE "imageUrl" IS NOT NULL AND btrim("imageUrl") <> '';
