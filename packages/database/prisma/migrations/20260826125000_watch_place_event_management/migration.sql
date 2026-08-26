-- Additive Watch/Place management extension.
-- Existing Places, Events, ownership, RSVP and Pitch data remain intact.

ALTER TABLE "Place" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "PlaceMenuItem" (
  "id" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(10,3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlaceMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchEventDetails" (
  "eventId" TEXT NOT NULL,
  "teamOneName" TEXT NOT NULL,
  "teamOneLogoUrl" TEXT,
  "teamTwoName" TEXT NOT NULL,
  "teamTwoLogoUrl" TEXT,
  CONSTRAINT "WatchEventDetails_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "Place_moderationStatus_archivedAt_createdAt_idx"
  ON "Place"("moderationStatus", "archivedAt", "createdAt");
CREATE INDEX "PlaceMenuItem_placeId_sortOrder_idx"
  ON "PlaceMenuItem"("placeId", "sortOrder");

ALTER TABLE "PlaceMenuItem"
  ADD CONSTRAINT "PlaceMenuItem_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WatchEventDetails"
  ADD CONSTRAINT "WatchEventDetails_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
