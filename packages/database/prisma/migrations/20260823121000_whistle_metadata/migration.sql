CREATE TYPE "WhistleContextType" AS ENUM ('COMMUNITY', 'EVENT', 'TEAM', 'RIDE', 'ULTRAS', 'GAMER_SQUAD');

CREATE TABLE "WhistleMetadata" (
  "id" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "contextType" "WhistleContextType" NOT NULL,
  "contextId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhistleMetadata_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhistleMetadata_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WhistleMetadata_contextType_contextId_createdAt_idx"
  ON "WhistleMetadata"("contextType", "contextId", "createdAt");
CREATE INDEX "WhistleMetadata_authorUserId_createdAt_idx"
  ON "WhistleMetadata"("authorUserId", "createdAt");
CREATE INDEX "WhistleMetadata_expiresAt_idx" ON "WhistleMetadata"("expiresAt");
