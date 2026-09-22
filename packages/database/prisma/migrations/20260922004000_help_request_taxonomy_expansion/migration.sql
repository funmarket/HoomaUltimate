ALTER TABLE "HelpRequest"
  ADD COLUMN "subcategoryId" TEXT,
  ADD COLUMN "needId" TEXT;

CREATE UNIQUE INDEX "HelpTaxonomySubcategory_id_sport_key"
  ON "HelpTaxonomySubcategory"("id", "sport");

CREATE UNIQUE INDEX "HelpTaxonomyNeed_id_subcategoryId_key"
  ON "HelpTaxonomyNeed"("id", "subcategoryId");

CREATE INDEX "HelpRequest_subcategoryId_status_createdAt_idx"
  ON "HelpRequest"("subcategoryId", "status", "createdAt");

CREATE INDEX "HelpRequest_needId_status_createdAt_idx"
  ON "HelpRequest"("needId", "status", "createdAt");

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategory_requires_sport_check"
  CHECK ("subcategoryId" IS NULL OR "sport" IS NOT NULL);

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_need_requires_subcategory_check"
  CHECK ("needId" IS NULL OR "subcategoryId" IS NOT NULL);

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "HelpTaxonomySubcategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_needId_fkey"
  FOREIGN KEY ("needId") REFERENCES "HelpTaxonomyNeed"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_subcategoryId_sport_fkey"
  FOREIGN KEY ("subcategoryId", "sport") REFERENCES "HelpTaxonomySubcategory"("id", "sport")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HelpRequest"
  ADD CONSTRAINT "HelpRequest_needId_subcategoryId_fkey"
  FOREIGN KEY ("needId", "subcategoryId") REFERENCES "HelpTaxonomyNeed"("id", "subcategoryId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
