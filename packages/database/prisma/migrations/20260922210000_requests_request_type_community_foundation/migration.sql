CREATE TYPE "HelpRequestType" AS ENUM ('SPORT', 'COMMUNITY');

ALTER TABLE "HelpTaxonomySubcategory"
  ADD COLUMN "requestType" "HelpRequestType";

UPDATE "HelpTaxonomySubcategory"
SET "requestType" = 'SPORT'::"HelpRequestType"
WHERE "requestType" IS NULL;

ALTER TABLE "HelpTaxonomySubcategory"
  ALTER COLUMN "requestType" SET NOT NULL,
  ALTER COLUMN "sport" DROP NOT NULL;

ALTER TABLE "HelpTaxonomySubcategory"
  ADD CONSTRAINT "HelpTaxonomySubcategory_request_type_sport_check"
  CHECK (
    ("requestType" = 'SPORT'::"HelpRequestType" AND "sport" IS NOT NULL)
    OR
    ("requestType" = 'COMMUNITY'::"HelpRequestType" AND "sport" IS NULL)
  );

CREATE UNIQUE INDEX "HelpTaxonomySubcategory_id_requestType_key"
  ON "HelpTaxonomySubcategory"("id", "requestType");

CREATE UNIQUE INDEX "HelpTaxonomySubcategory_community_slug_key"
  ON "HelpTaxonomySubcategory"("slug")
  WHERE "requestType" = 'COMMUNITY'::"HelpRequestType";

CREATE INDEX "HelpTaxonomySubcategory_requestType_active_sortOrder_idx"
  ON "HelpTaxonomySubcategory"("requestType", "active", "sortOrder");

ALTER TABLE "HelpRequest"
  ADD COLUMN "requestType" "HelpRequestType";

-- Existing rows with a resolved taxonomy subcategory are deterministically SPORT
-- because the current schema requires their subcategory to reference a sport-owned taxonomy row.
UPDATE "HelpRequest"
SET "requestType" = 'SPORT'::"HelpRequestType"
WHERE "subcategoryId" IS NOT NULL
  AND "sport" IS NOT NULL;

ALTER TABLE "HelpRequest"
  DROP CONSTRAINT "HelpRequest_subcategory_requires_sport_check";

ALTER TABLE "HelpRequest"
  DROP CONSTRAINT "HelpRequest_subcategoryId_sport_fkey";

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_request_type_taxonomy_check"
  CHECK (
    "subcategoryId" IS NULL
    OR (
      "requestType" = 'SPORT'::"HelpRequestType"
      AND "sport" IS NOT NULL
    )
    OR (
      "requestType" = 'COMMUNITY'::"HelpRequestType"
      AND "sport" IS NULL
    )
  );

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategoryId_requestType_fkey"
  FOREIGN KEY ("subcategoryId", "requestType")
  REFERENCES "HelpTaxonomySubcategory"("id", "requestType")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "HelpRequest_requestType_status_createdAt_idx"
  ON "HelpRequest"("requestType", "status", "createdAt");

INSERT INTO "HelpTaxonomySubcategory"
  ("id", "requestType", "sport", "slug", "label", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('hts-community-lost-found', 'COMMUNITY'::"HelpRequestType", NULL, 'lost-found', 'Lost & Found', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-questions-advice', 'COMMUNITY'::"HelpRequestType", NULL, 'questions-advice', 'Questions & Advice', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-people-needs', 'COMMUNITY'::"HelpRequestType", NULL, 'personal-people-needs', 'Personal & People Needs', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-local-help', 'COMMUNITY'::"HelpRequestType", NULL, 'local-help-services', 'Local Help & Services', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-activities', 'COMMUNITY'::"HelpRequestType", NULL, 'community-activities', 'Community Activities', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-borrow-share', 'COMMUNITY'::"HelpRequestType", NULL, 'borrow-share', 'Borrow & Share', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-information', 'COMMUNITY'::"HelpRequestType", NULL, 'information-notice', 'Information & Notice', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-other', 'COMMUNITY'::"HelpRequestType", NULL, 'other', 'Other', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeed"
  ("id", "subcategoryId", "slug", "label", "kind", "allowsCustomText", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('htn-community-lost-item', 'hts-community-lost-found', 'lost-item', 'Lost item', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-found-item', 'hts-community-lost-found', 'found-item', 'Found item', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lost-pet', 'hts-community-lost-found', 'lost-pet', 'Lost pet', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lost-found-other', 'hts-community-lost-found', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-question', 'hts-community-questions-advice', 'question', 'I have a question', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-recommendation', 'hts-community-questions-advice', 'local-recommendation', 'Local recommendation', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-advice', 'hts-community-questions-advice', 'advice-needed', 'Advice needed', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-how-to', 'hts-community-questions-advice', 'how-to', 'How do I...?', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-other', 'hts-community-questions-advice', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-helping-hand', 'hts-community-people-needs', 'helping-hand', 'Need a helping hand', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-task-help', 'hts-community-people-needs', 'task-help', 'Need someone for a task', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-person', 'hts-community-people-needs', 'local-person-service', 'Looking for a local person or service', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-volunteer-help', 'hts-community-people-needs', 'volunteer-help', 'Volunteer help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-other', 'hts-community-people-needs', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-moving-help', 'hts-community-local-help', 'moving-carrying-help', 'Moving or carrying help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-repair-help', 'hts-community-local-help', 'repair-maintenance-help', 'Repair or maintenance help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-errand-help', 'hts-community-local-help', 'errand-help', 'Errand help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-other', 'hts-community-local-help', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-people-join', 'hts-community-activities', 'people-to-join', 'Looking for people to join', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-organize-activity', 'hts-community-activities', 'organizing-activity', 'Organizing an activity', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-volunteer-opportunity', 'hts-community-activities', 'volunteer-opportunity', 'Volunteer opportunity', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-meetup', 'hts-community-activities', 'community-meetup', 'Community meetup', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-activities-other', 'hts-community-activities', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-borrow-item', 'hts-community-borrow-share', 'borrow-item', 'Need to borrow something', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lend-item', 'hts-community-borrow-share', 'lend-item', 'Have something to lend', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-need-equipment', 'hts-community-borrow-share', 'need-equipment', 'Need equipment', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-borrow-share-other', 'hts-community-borrow-share', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-local-information', 'hts-community-information', 'local-information', 'Local information needed', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-notice', 'hts-community-information', 'community-notice', 'Community notice', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-recommendation-wanted', 'hts-community-information', 'recommendation-wanted', 'Recommendation wanted', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-information-other', 'hts-community-information', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  ('htn-community-other-manual', 'hts-community-other', 'manual-need', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeedSurface" ("needId", "surface")
SELECT "id", 'REQUESTS'::"HelpTaxonomySurface"
FROM "HelpTaxonomyNeed"
WHERE "id" LIKE 'htn-community-%';
