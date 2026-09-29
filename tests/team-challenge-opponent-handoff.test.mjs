import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const teamsPagePath = "packages/frontend/src/teams/TeamsPage.tsx";
const controlRoomPath = "packages/frontend/src/teams/CoachControlRoomPage.tsx";

test("Team discovery Challenge carries the selected opponent into Coach Control Room", async () => {
  const [teamsPage, controlRoom] = await Promise.all([
    readFile(teamsPagePath, "utf8"),
    readFile(controlRoomPath, "utf8"),
  ]);

  assert.match(
    teamsPage,
    /\/teams\/control\?challengedTeamId=\$\{encodeURIComponent\(team\.id\)\}/,
  );
  assert.match(controlRoom, /useSearchParams/);
  assert.match(controlRoom, /get\("challengedTeamId"\)/);
  assert.match(controlRoom, /rows\.find\(\(candidate\) => candidate\.id !== challengedTeamId\)/);
});

test("Coach Control Room chooses opponents by Team identity, never by a typed database id", async () => {
  const controlRoom = await readFile(controlRoomPath, "utf8");

  assert.match(controlRoom, />\s*Opponent Team\s*</);
  assert.match(controlRoom, /<select[\s\S]*name="challengedTeamId"/);
  assert.match(controlRoom, /api\.teams\.publicList\(\{ limit: 100 \}\)/);
  assert.match(controlRoom, /<option[\s\S]*value=\{candidate\.id\}[\s\S]*candidate\.name/);
  assert.doesNotMatch(controlRoom, /Opponent Team ID/);
  assert.doesNotMatch(controlRoom, /<input name="challengedTeamId"/);
});
