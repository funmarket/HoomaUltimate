CREATE TYPE "HelpTaxonomyNeedKind" AS ENUM ('PRODUCT', 'COMMUNITY_ROLE', 'COMMUNITY_SUPPORT');
CREATE TYPE "HelpTaxonomySurface" AS ENUM ('REQUESTS', 'PLAY', 'ATHLETES', 'DONATIONS');

CREATE TABLE "HelpTaxonomySubcategory" (
  "id" TEXT NOT NULL,
  "sport" "AthletesSport" NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpTaxonomySubcategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpTaxonomyNeed" (
  "id" TEXT NOT NULL,
  "subcategoryId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "HelpTaxonomyNeedKind" NOT NULL,
  "allowsCustomText" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpTaxonomyNeed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpTaxonomyNeedSurface" (
  "needId" TEXT NOT NULL,
  "surface" "HelpTaxonomySurface" NOT NULL,
  CONSTRAINT "HelpTaxonomyNeedSurface_pkey" PRIMARY KEY ("needId", "surface")
);

CREATE UNIQUE INDEX "HelpTaxonomySubcategory_sport_slug_key"
  ON "HelpTaxonomySubcategory"("sport", "slug");
CREATE INDEX "HelpTaxonomySubcategory_sport_active_sortOrder_idx"
  ON "HelpTaxonomySubcategory"("sport", "active", "sortOrder");
CREATE UNIQUE INDEX "HelpTaxonomyNeed_subcategoryId_slug_key"
  ON "HelpTaxonomyNeed"("subcategoryId", "slug");
CREATE INDEX "HelpTaxonomyNeed_subcategoryId_active_sortOrder_idx"
  ON "HelpTaxonomyNeed"("subcategoryId", "active", "sortOrder");
CREATE INDEX "HelpTaxonomyNeed_kind_active_idx"
  ON "HelpTaxonomyNeed"("kind", "active");
CREATE INDEX "HelpTaxonomyNeedSurface_surface_needId_idx"
  ON "HelpTaxonomyNeedSurface"("surface", "needId");

ALTER TABLE "HelpTaxonomyNeed"
  ADD CONSTRAINT "HelpTaxonomyNeed_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "HelpTaxonomySubcategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HelpTaxonomyNeedSurface"
  ADD CONSTRAINT "HelpTaxonomyNeedSurface_needId_fkey"
  FOREIGN KEY ("needId") REFERENCES "HelpTaxonomyNeed"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "HelpTaxonomySubcategory"
  ("id", "sport", "slug", "label", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('hts-cycling-equipment', 'CYCLING'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-cycling-roles', 'CYCLING'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-running-footwear', 'RUNNING'::"AthletesSport", 'footwear', 'Footwear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-running-equipment', 'RUNNING'::"AthletesSport", 'equipment-accessories', 'Equipment & Accessories', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-running-roles', 'RUNNING'::"AthletesSport", 'community-roles', 'Community Roles', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-swimming-equipment', 'SWIMMING'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-swimming-roles', 'SWIMMING'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-football-footwear', 'FOOTBALL'::"AthletesSport", 'footwear-boots', 'Footwear & Boots', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-football-equipment', 'FOOTBALL'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-football-roles', 'FOOTBALL'::"AthletesSport", 'community-roles', 'Community Roles', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-football-support', 'FOOTBALL'::"AthletesSport", 'community-support', 'Community Support', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-basketball-equipment', 'BASKETBALL'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-basketball-roles', 'BASKETBALL'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-tennis-equipment', 'TENNIS'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-tennis-roles', 'TENNIS'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-padel-equipment', 'PADEL'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-padel-roles', 'PADEL'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-gym-equipment', 'GYM_FITNESS'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-gym-roles', 'GYM_FITNESS'::"AthletesSport", 'community-roles', 'Community Roles', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-gym-support', 'GYM_FITNESS'::"AthletesSport", 'community-support', 'Community Support', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-other-equipment', 'OTHER'::"AthletesSport", 'equipment-gear', 'Equipment & Gear', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-other-support', 'OTHER'::"AthletesSport", 'community-support', 'Community Support', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeed"
  ("id", "subcategoryId", "slug", "label", "kind", "allowsCustomText", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('htn-cycling-helmet', 'hts-cycling-equipment', 'helmet', 'Helmet', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-cycling-repair-kit', 'hts-cycling-equipment', 'repair-kit', 'Repair Kit', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-cycling-riding-partner', 'hts-cycling-roles', 'riding-partner', 'Riding Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-cycling-ride-leader', 'hts-cycling-roles', 'ride-leader', 'Ride Leader', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-running-road-shoes', 'hts-running-footwear', 'road-running-shoes', 'Road Running Shoes', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-running-trail-shoes', 'hts-running-footwear', 'trail-running-shoes', 'Trail Running Shoes', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-running-hydration-pack', 'hts-running-equipment', 'hydration-pack', 'Hydration Pack', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-running-partner', 'hts-running-roles', 'running-partner', 'Running Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-running-pace-partner', 'hts-running-roles', 'pace-partner', 'Pace Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-swimming-goggles', 'hts-swimming-equipment', 'goggles', 'Goggles', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-swimming-cap', 'hts-swimming-equipment', 'swim-cap', 'Swim Cap', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-swimming-partner', 'hts-swimming-roles', 'swim-partner', 'Swim Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-turf-shoes', 'hts-football-footwear', 'turf-shoes', 'Turf Shoes', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-fg-boots', 'hts-football-footwear', 'firm-ground-boots', 'Firm Ground Boots', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-ball', 'hts-football-equipment', 'football', 'Football', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-cones', 'hts-football-equipment', 'training-cones', 'Training Cones', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-gloves', 'hts-football-equipment', 'goalkeeper-gloves', 'Goalkeeper Gloves', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-goalkeeper', 'hts-football-roles', 'goalkeeper', 'Goalkeeper', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-referee', 'hts-football-roles', 'referee', 'Referee', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-coach', 'hts-football-roles', 'coach', 'Coach', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-session-support', 'hts-football-support', 'training-session-support', 'Training Session Support', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-basketball-ball', 'hts-basketball-equipment', 'basketball', 'Basketball', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-basketball-shoes', 'hts-basketball-equipment', 'basketball-shoes', 'Basketball Shoes', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-basketball-player', 'hts-basketball-roles', 'pickup-player', 'Pickup Player', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-basketball-coach', 'hts-basketball-roles', 'coach', 'Coach', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-tennis-racket', 'hts-tennis-equipment', 'tennis-racket', 'Tennis Racket', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-tennis-balls', 'hts-tennis-equipment', 'tennis-balls', 'Tennis Balls', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-tennis-partner', 'hts-tennis-roles', 'hitting-partner', 'Hitting Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-tennis-coach', 'hts-tennis-roles', 'coach', 'Coach', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-padel-racket', 'hts-padel-equipment', 'padel-racket', 'Padel Racket', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-padel-balls', 'hts-padel-equipment', 'padel-balls', 'Padel Balls', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-padel-partner', 'hts-padel-roles', 'padel-partner', 'Padel Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-bands', 'hts-gym-equipment', 'resistance-bands', 'Resistance Bands', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-belt', 'hts-gym-equipment', 'lifting-belt', 'Lifting Belt', 'PRODUCT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-partner', 'hts-gym-roles', 'gym-partner', 'Gym Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-spotter', 'hts-gym-roles', 'spotter', 'Spotter', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-coach', 'hts-gym-roles', 'coach', 'Coach', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-gym-form-check', 'hts-gym-support', 'form-check', 'Form Check', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-other-gear', 'hts-other-equipment', 'other-sports-gear', 'Other Sports Gear', 'PRODUCT'::"HelpTaxonomyNeedKind", true, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-other-need', 'hts-other-support', 'other-sports-need', 'Other Sports Need', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeedSurface" ("needId", "surface")
VALUES
  ('htn-cycling-helmet', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-cycling-helmet', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-cycling-helmet', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-cycling-repair-kit', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-cycling-repair-kit', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-cycling-repair-kit', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-cycling-riding-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-cycling-riding-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-cycling-ride-leader', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-cycling-ride-leader', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-running-road-shoes', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-running-road-shoes', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-running-road-shoes', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-running-trail-shoes', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-running-trail-shoes', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-running-trail-shoes', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-running-hydration-pack', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-running-hydration-pack', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-running-hydration-pack', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-running-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-running-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-running-pace-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-running-pace-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-swimming-goggles', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-swimming-goggles', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-swimming-goggles', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-swimming-cap', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-swimming-cap', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-swimming-cap', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-swimming-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-swimming-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-turf-shoes', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-turf-shoes', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-turf-shoes', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-turf-shoes', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-football-fg-boots', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-fg-boots', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-fg-boots', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-fg-boots', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-football-ball', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-ball', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-ball', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-ball', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-football-cones', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-cones', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-cones', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-cones', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-football-gloves', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-gloves', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-gloves', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-gloves', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-football-goalkeeper', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-goalkeeper', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-goalkeeper', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-referee', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-referee', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-referee', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-coach', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-coach', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-coach', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-football-session-support', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-football-session-support', 'PLAY'::"HelpTaxonomySurface"),
  ('htn-football-session-support', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-basketball-ball', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-basketball-ball', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-basketball-ball', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-basketball-shoes', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-basketball-shoes', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-basketball-shoes', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-basketball-player', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-basketball-player', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-basketball-coach', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-basketball-coach', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-tennis-racket', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-tennis-racket', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-tennis-racket', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-tennis-balls', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-tennis-balls', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-tennis-balls', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-tennis-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-tennis-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-tennis-coach', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-tennis-coach', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-padel-racket', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-padel-racket', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-padel-racket', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-padel-balls', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-padel-balls', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-padel-balls', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-padel-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-padel-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-bands', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-bands', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-bands', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-gym-belt', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-belt', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-belt', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-gym-partner', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-partner', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-spotter', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-spotter', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-coach', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-coach', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-gym-form-check', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-gym-form-check', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-other-gear', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-other-gear', 'ATHLETES'::"HelpTaxonomySurface"),
  ('htn-other-gear', 'DONATIONS'::"HelpTaxonomySurface"),
  ('htn-other-need', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-other-need', 'ATHLETES'::"HelpTaxonomySurface");
