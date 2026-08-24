import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const foundationMigration =
  "packages/database/prisma/migrations/20260823003000_initial_foundation/migration.sql";
const lineupMigration =
  "packages/database/prisma/migrations/20260824120000_team_lineup_slot_coordinates/migration.sql";
const required = [
  "apps/api/src/modules/communities/domain/community-access.ts",
  "apps/api/src/modules/communities/application/community.service.ts",
  "apps/api/src/modules/communities/infrastructure/prisma-community.repository.ts",
  "apps/api/src/modules/teams/domain/team-access.ts",
  "apps/api/src/modules/teams/application/team.service.ts",
  "apps/api/src/modules/teams/application/team.repository.ts",
  "apps/api/src/modules/teams/infrastructure/prisma-team.repository.ts",
  "apps/api/src/modules/teams/http/team.routes.ts",
  "packages/frontend/src/teams/CreateTeamPage.tsx",
  foundationMigration,
  lineupMigration,
];

test("Communities and Teams are layered target modules", async () => {
  await Promise.all(required.map((path) => access(path)));
});

test("scoped ADMIN role does not return in Community or Team schema", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  assert.match(schema, /enum CommunityRole\s*{[\s\S]*FOUNDER[\s\S]*COACH[\s\S]*MEMBER/);
  assert.doesNotMatch(schema, /enum CommunityRole\s*{[\s\S]*\bADMIN\b/);
  assert.match(schema, /enum TeamResponsibilityRole\s*{[\s\S]*COACH[\s\S]*ASSISTANT/);
});

test("database enforces no self-challenge in addition to service policy", async () => {
  const migration = await readFile(foundationMigration, "utf8");
  assert.match(migration, /TeamChallenge_different_teams/);
});

test("Team lineup persistence follows canonical TeamPlayer and current-lineup ownership", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  const migration = await readFile(lineupMigration, "utf8");
  assert.match(schema, /model TeamLineup[\s\S]*isCurrent\s+Boolean/);
  assert.match(schema, /model TeamLineupSlot[\s\S]*teamPlayerId\s+String\?/);
  assert.match(schema, /model TeamLineupSlot[\s\S]*isStarter\s+Boolean/);
  assert.doesNotMatch(schema, /model TeamLineupSlot[\s\S]*\n\s+userId\s+String\?/);
  assert.match(migration, /TeamLineup_one_current_per_team_key/);
  assert.match(migration, /TeamLineupSlot_teamPlayerId_fkey/);
  assert.match(migration, /TeamLineupSlot_x_range/);
  assert.match(migration, /TeamLineupSlot_y_range/);
});

test("Team creation uses a dedicated page instead of an inline discovery form", async () => {
  const [teamsPage, createTeamPage, router, frontendIndex] = await Promise.all([
    readFile("packages/frontend/src/teams/TeamsPage.tsx", "utf8"),
    readFile("packages/frontend/src/teams/CreateTeamPage.tsx", "utf8"),
    readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8"),
    readFile("packages/frontend/src/index.ts", "utf8"),
  ]);

  assert.ok(teamsPage.includes('href="/teams/new"'));
  assert.ok(teamsPage.includes("Create A Team"));
  assert.ok(!teamsPage.includes("team-create-panel"));
  assert.ok(!teamsPage.includes("async function createTeam"));
  assert.ok(createTeamPage.includes("api.teams.create"));
  assert.ok(createTeamPage.includes("Community"));
  assert.ok(createTeamPage.includes("Team logo / crest URL"));
  assert.ok(createTeamPage.includes("Banner image URL"));
  assert.ok(router.includes('path="/teams/new" element={<CreateTeamPage />}'));
  assert.ok(frontendIndex.includes("./teams/CreateTeamPage"));
});
