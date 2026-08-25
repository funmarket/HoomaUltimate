-- Canonical Team authority permits revoked history but only one active identical
-- Team/User/role responsibility at a time. PostgreSQL owns this concurrency invariant.
CREATE UNIQUE INDEX "TeamResponsibilityAssignment_active_team_user_role_key"
ON "TeamResponsibilityAssignment" ("teamId", "userId", "role")
WHERE "revokedAt" IS NULL;
