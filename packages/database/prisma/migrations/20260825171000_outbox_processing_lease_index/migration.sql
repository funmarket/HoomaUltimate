-- Stale Outbox PROCESSING leases are reclaimed by the Worker.
-- Keep this maintenance index scoped to rows that can actually be reclaimed.

CREATE INDEX "OutboxEvent_processing_claimedAt_idx"
ON "OutboxEvent" ("claimedAt", "id")
WHERE "status" = 'PROCESSING' AND "claimedAt" IS NOT NULL;
