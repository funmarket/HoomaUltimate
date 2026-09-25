CREATE TYPE "HelpRequestImageSource" AS ENUM ('UPLOAD', 'EXTERNAL_URL');

CREATE TABLE "HelpRequestImage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "HelpRequestImageSource" NOT NULL,
    "objectKey" TEXT,
    "externalUrl" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRequestImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HelpRequestImage_source_shape_check" CHECK (
      (
        "source" = 'UPLOAD'::"HelpRequestImageSource"
        AND "objectKey" IS NOT NULL
        AND "externalUrl" IS NULL
        AND "contentType" IN ('image/jpeg', 'image/png', 'image/webp')
        AND "sizeBytes" IS NOT NULL
        AND "sizeBytes" > 0
      )
      OR
      (
        "source" = 'EXTERNAL_URL'::"HelpRequestImageSource"
        AND "objectKey" IS NULL
        AND "externalUrl" IS NOT NULL
        AND "contentType" IS NULL
        AND "sizeBytes" IS NULL
      )
    )
);

CREATE UNIQUE INDEX "HelpRequestImage_requestId_key"
ON "HelpRequestImage"("requestId");

CREATE UNIQUE INDEX "HelpRequestImage_objectKey_key"
ON "HelpRequestImage"("objectKey");

CREATE INDEX "HelpRequestImage_createdAt_idx"
ON "HelpRequestImage"("createdAt");

ALTER TABLE "HelpRequestImage"
ADD CONSTRAINT "HelpRequestImage_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
