import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coachPagePath = "packages/frontend/src/teams/CoachControlRoomPage.tsx";
const sharedApiPath = "packages/frontend/src/api.ts";

test("Coach Control Room is Team management, not global Admin", async () => {
  const page = await readFile(coachPagePath, "utf8");
  assert.match(page, /Coach Control Room/);
  assert.doesNotMatch(page, /Admin Dashboard|Platform Admin/);
  for (const capability of [
    "EDIT_TEAM",
    "MANAGE_ROSTER",
    "MANAGE_LINEUP",
    "CREATE_CHALLENGE",
    "RESPOND_TO_CHALLENGE",
    "MANAGE_TEAM_EVENTS",
  ]) {
    assert.match(page, new RegExp(capability));
  }
});

test("Coach Control Room consumes protected Team APIs rather than duplicating state", async () => {
  const client = await readFile(sharedApiPath, "utf8");
  for (const path of [
    "/api/v1/teams/managed",
    "/api/v1/teams/challenges/incoming",
    "/api/v1/teams/challenges/outgoing",
    "/assistants",
    "/lineups",
  ]) {
    assert.match(client, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(client, /@hooma\/database|@prisma\/client/);
});

test("Team lineup separates Formation from match format and offers standard plus custom Formation", async () => {
  const page = await readFile(coachPagePath, "utf8");
  const contracts = await readFile("packages/contracts/src/index.ts", "utf8");
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  const repository = await readFile(
    "apps/api/src/modules/teams/infrastructure/prisma-team.repository.ts",
    "utf8",
  );

  for (const formation of ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3"]) {
    assert.match(contracts, new RegExp(formation.replaceAll("-", "\\-")));
  }
  assert.match(page, /Custom formation/);
  assert.match(page, /Match format/);
  assert.match(contracts, /formation: teamFormationSchema/);
  assert.match(contracts, /matchFormat: footballFormatSchema/);
  assert.match(schema, /formation\s+String/);
  assert.match(schema, /matchFormat\s+FootballFormat/);
  assert.doesNotMatch(schema, /model TeamLineup \{[\s\S]*?\n\s+format\s+FootballFormat/);
  assert.match(repository, /formation: input\.formation/);
  assert.match(repository, /matchFormat: input\.matchFormat/);
});

test("every Team player is backed by a HOOMA User without global user uniqueness", async () => {
  const contracts = await readFile("packages/contracts/src/index.ts", "utf8");
  const schema = await readFile("packages/database/prisma/schema.prisma", "utf8");
  assert.match(
    contracts,
    /teamPlayerSchema = z\.object\(\{ userId: z\.string\(\)\.min\(1\) \}\)/,
  );
  const teamPlayer = schema.match(/model TeamPlayer \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(teamPlayer, /userId\s+String/);
  assert.doesNotMatch(teamPlayer, /userId\s+String\s+@unique/);
  assert.match(teamPlayer, /@@unique\(\[teamId, userId\]\)/);
});
