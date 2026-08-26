CREATE TYPE "GamerMatchSessionStatus" AS ENUM (
  'WAITING_FOR_CODE',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'DISPUTED',
  'VOIDED'
);

CREATE TYPE "GamerMatchSide" AS ENUM ('CHALLENGER', 'CHALLENGED');

CREATE TYPE "GamerMatchResolution" AS ENUM (
  'MATCHED_SUBMISSIONS',
  'SINGLE_SUBMISSION_TIMEOUT',
  'PLATFORM_ADMIN',
  'PLATFORM_ADMIN_VOID'
);

CREATE TABLE "GamerMatchSession" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "status" "GamerMatchSessionStatus" NOT NULL DEFAULT 'WAITING_FOR_CODE',
  "roomCode" TEXT,
  "submissionDeadline" TIMESTAMP(3),
  "finalChallengerScore" INTEGER,
  "finalChallengedScore" INTEGER,
  "winnerSide" "GamerMatchSide",
  "resolution" "GamerMatchResolution",
  "resolvedAt" TIMESTAMP(3),
  "moderatorNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerMatchSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamerMatchSession_roomCode_check" CHECK ("roomCode" IS NULL OR "roomCode" ~ '^[0-9]{6}$'),
  CONSTRAINT "GamerMatchSession_final_scores_check" CHECK (
    ("finalChallengerScore" IS NULL OR "finalChallengerScore" >= 0) AND
    ("finalChallengedScore" IS NULL OR "finalChallengedScore" >= 0)
  )
);

CREATE TABLE "GamerMatchSubmission" (
  "id" TEXT NOT NULL,
  "matchSessionId" TEXT NOT NULL,
  "side" "GamerMatchSide" NOT NULL,
  "challengerScore" INTEGER NOT NULL,
  "challengedScore" INTEGER NOT NULL,
  "proofObjectKey" TEXT NOT NULL,
  "proofContentType" TEXT NOT NULL,
  "proofSizeBytes" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerMatchSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamerMatchSubmission_scores_check" CHECK ("challengerScore" >= 0 AND "challengedScore" >= 0),
  CONSTRAINT "GamerMatchSubmission_proof_size_check" CHECK ("proofSizeBytes" > 0 AND "proofSizeBytes" <= 5242880)
);

CREATE UNIQUE INDEX "GamerMatchSession_challengeId_key" ON "GamerMatchSession"("challengeId");
CREATE INDEX "GamerMatchSession_status_updatedAt_idx" ON "GamerMatchSession"("status", "updatedAt");
CREATE UNIQUE INDEX "GamerMatchSubmission_matchSessionId_side_key" ON "GamerMatchSubmission"("matchSessionId", "side");
CREATE INDEX "GamerMatchSubmission_matchSessionId_submittedAt_idx" ON "GamerMatchSubmission"("matchSessionId", "submittedAt");

ALTER TABLE "GamerMatchSession"
  ADD CONSTRAINT "GamerMatchSession_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "GamerChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GamerMatchSubmission"
  ADD CONSTRAINT "GamerMatchSubmission_matchSessionId_fkey"
  FOREIGN KEY ("matchSessionId") REFERENCES "GamerMatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
