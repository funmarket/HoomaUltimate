INSERT INTO "HelpTaxonomyNeed"
  ("id", "subcategoryId", "slug", "label", "kind", "allowsCustomText", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('htn-football-player', 'hts-football-roles', 'player', 'Player', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-assistant-coach', 'hts-football-roles', 'assistant-coach', 'Assistant Coach', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-training-session', 'hts-football-roles', 'training-session', 'Training Session', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-training-group', 'hts-football-roles', 'training-group', 'Training Group', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-football-training-partner', 'hts-football-roles', 'training-partner', 'Training Partner', 'COMMUNITY_ROLE'::"HelpTaxonomyNeedKind", false, 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeed"
  ("id", "subcategoryId", "slug", "label", "kind", "allowsCustomText", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'htn-' || substring(subcategory."id" FROM 5) || '-other',
  subcategory."id",
  'other',
  'Other',
  seed."kind",
  true,
  90,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "HelpTaxonomySubcategory" AS subcategory
JOIN LATERAL (
  SELECT need."kind"
  FROM "HelpTaxonomyNeed" AS need
  WHERE need."subcategoryId" = subcategory."id"
  ORDER BY need."sortOrder" ASC, need."id" ASC
  LIMIT 1
) AS seed ON true
WHERE subcategory."requestType" = 'SPORT'::"HelpRequestType"
  AND NOT EXISTS (
    SELECT 1
    FROM "HelpTaxonomyNeed" AS existing
    WHERE existing."subcategoryId" = subcategory."id"
      AND existing."slug" = 'other'
  );

INSERT INTO "HelpTaxonomyNeedSurface" ("needId", "surface")
SELECT need."id", 'REQUESTS'::"HelpTaxonomySurface"
FROM "HelpTaxonomyNeed" AS need
WHERE need."id" IN (
  'htn-football-player',
  'htn-football-assistant-coach',
  'htn-football-training-session',
  'htn-football-training-group',
  'htn-football-training-partner'
)
ON CONFLICT ("needId", "surface") DO NOTHING;

INSERT INTO "HelpTaxonomyNeedSurface" ("needId", "surface")
SELECT need."id", 'REQUESTS'::"HelpTaxonomySurface"
FROM "HelpTaxonomyNeed" AS need
JOIN "HelpTaxonomySubcategory" AS subcategory
  ON subcategory."id" = need."subcategoryId"
WHERE subcategory."requestType" = 'SPORT'::"HelpRequestType"
  AND need."slug" = 'other'
ON CONFLICT ("needId", "surface") DO NOTHING;
