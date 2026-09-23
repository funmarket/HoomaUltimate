ALTER TABLE "HelpRequest"
  DROP CONSTRAINT "HelpRequest_request_type_taxonomy_check";

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_request_type_taxonomy_check"
  CHECK (
    "subcategoryId" IS NULL
    OR (
      "requestType" IS NOT NULL
      AND (
        (
          "requestType" = 'SPORT'::"HelpRequestType"
          AND "sport" IS NOT NULL
        )
        OR (
          "requestType" = 'COMMUNITY'::"HelpRequestType"
          AND "sport" IS NULL
        )
      )
    )
  );

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategoryId_sport_fkey"
  FOREIGN KEY ("subcategoryId", "sport")
  REFERENCES "HelpTaxonomySubcategory"("id", "sport")
  ON DELETE RESTRICT ON UPDATE CASCADE;
