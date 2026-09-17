CREATE TYPE "HelpRequestResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "HelpRequestResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "HelpRequestResponseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "HelpRequestResponse_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HelpRequestResponse_message_nonempty_check" CHECK (char_length(btrim("message")) > 0)
);

CREATE UNIQUE INDEX "HelpRequestResponse_requestId_responderUserId_key"
ON "HelpRequestResponse"("requestId", "responderUserId");

CREATE INDEX "HelpRequestResponse_requestId_status_createdAt_idx"
ON "HelpRequestResponse"("requestId", "status", "createdAt");

CREATE INDEX "HelpRequestResponse_responderUserId_status_createdAt_idx"
ON "HelpRequestResponse"("responderUserId", "status", "createdAt");

ALTER TABLE "HelpRequestResponse" ADD CONSTRAINT "HelpRequestResponse_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HelpRequestResponse" ADD CONSTRAINT "HelpRequestResponse_responderUserId_fkey"
FOREIGN KEY ("responderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
