import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Coach Control Room is Team management, not global Admin", async () => {
  const page = await readFile("apps/web/src/teams/CoachControlRoomPage.tsx", "utf8");
  assert.match(page, /Coach Control Room/);
  assert.doesNotMatch(page, /Admin Dashboard|Platform Admin/);
  for (const capability of [
    "EDIT_TEAM",
    "MANAGE_ROSTER",
    "MANAGE_LINEUP",
    "CREATE_CHALLENGE",
    "RESPOND_TO_CHALLENGE",
    "MANAGE_TEAM_EVENTS"
  ]) assert.match(page, new RegExp(capability));
});

test("Coach Control Room consumes protected Team APIs rather than duplicating state", async () => {
  const client = await readFile("apps/web/src/api/team-client.ts", "utf8");
  for (const path of [
    "/api/v1/teams/managed",
    "/api/v1/teams/challenges/incoming",
    "/api/v1/teams/challenges/outgoing",
    "/assistants",
    "/lineups"
  ]) assert.match(client, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(client, /@hooma\/database|@prisma\/client/);
});
