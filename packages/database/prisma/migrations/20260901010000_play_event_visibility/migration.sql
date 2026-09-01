CREATE TYPE "PlayEventVisibility" AS ENUM ('OPEN', 'PRIVATE');

ALTER TABLE "PlayEventDetails"
ADD COLUMN "visibility" "PlayEventVisibility" NOT NULL DEFAULT 'OPEN';
