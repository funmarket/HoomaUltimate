-- Optional Request photo.
-- One image capability: either a requester-supplied image URL or one server-stored
-- uploaded image delivered through the canonical Requests image route. The object
-- key stays private and is never returned by the API.

ALTER TABLE "HelpRequest"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageObjectKey" TEXT,
  ADD COLUMN "imageContentType" TEXT,
  ADD COLUMN "imageSizeBytes" INTEGER;

CREATE UNIQUE INDEX "HelpRequest_imageObjectKey_key"
  ON "HelpRequest"("imageObjectKey");
