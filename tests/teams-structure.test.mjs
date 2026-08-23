import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const required = [
  "apps/api/src/modules/communities/domain/community-access.ts",
  "apps/api/src/modules/communities/application/community.service.ts",
  "apps/api/src/modules/communities/infrastructure/prisma-community.repository.ts",
  "apps/api/src/modules/teams/domain/team-access.ts",
  "apps/api/src/modules/teams/application/team.service.ts",
  "apps/api/src/modules/teams/application/team.repository.ts",
  "apps/api/src/modules/teams/infrastructure/prisma-team.repository.ts",
  "apps/api/src/modules/teams/http/team.routes.ts",
];

async function migrationSql() {
  const root = "packages/database/prisma/migrations";
  const entries = await readdir(root, { withFileTypes: true });
  const sql = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFile(`${root}/${entry.name}/migration.sql`, "utf8")),
  );
  return sql.join("\n");
}

test("Communities and Teams are layered target modules", async () => {
  await Promise.all(required.map((path) => access(path)));
  const migrations = await migrationSql();
  assert.match(migrations, /CREATE TABLE "Community"/);
  assert.match(migrations, /CREATE TABLE "Team"/);
});

test("scoped ADMIN role does not return in Community or Team schema", async () => {
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  assert.match(schema, /enum CommunityRole\s*{[\s\S]*FOUNDER[\s\S]*COACH[\s\S]*MEMBER/);
  assert.doesNotMatch(schema, /enum CommunityRole\s*{[\s\S]*\bADMIN\b/);
  assert.match(schema, /enum TeamResponsibilityRole\s*{[\s\S]*COACH[\s\S]*ASSISTANT/);
});

test("database enforces no self-challenge in addition to service policy", async () => {
  assert.match(await migrationSql(), /TeamChallenge_different_teams/);
});
