import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coachPage = "packages/frontend/src/teams/CoachControlRoomPage.tsx";
const editPage = "packages/frontend/src/teams/TeamEditPage.tsx";
const router = "apps/web/src/app/router/HoomaRouter.tsx";
const styles = "packages/frontend/src/teams/coach-control-room.css";

test("Coach Control Room keeps Team settings and lineup as dedicated priority actions", async () => {
  const source = await readFile(coachPage, "utf8");

  assert.match(source, /control-room__priority-stack/);
  assert.match(
    source,
    /<TeamSettingsCard team=\{team\} \/>[\s\S]*<LineupControlCard team=\{team\} \/>/,
  );
  assert.match(source, /href=\{`\/teams\/\$\{team\.id\}\/edit`\}/);
  assert.match(source, /href=\{`\/teams\/\$\{team\.id\}\/lineup`\}/);
  assert.match(source, /className="coach-primary-action"[\s\S]*Open builder/);
  assert.doesNotMatch(source, /function EditTeamCard/);
  assert.doesNotMatch(source, /name="badgeUrl"|name="bannerUrl"/);
});

test("Team settings use the existing Team update API on a dedicated route", async () => {
  const [page, routes] = await Promise.all([readFile(editPage, "utf8"), readFile(router, "utf8")]);

  assert.match(page, /api\.teams\.update\(team\.id/);
  assert.match(page, /name="badgeUrl"/);
  assert.match(page, /name="bannerUrl"/);
  assert.match(page, /api\.teams\.managed\(\)/);
  assert.match(routes, /path="\/teams\/:teamId\/edit"/);
  assert.match(routes, /<TeamEditPage teamId=/);
});

test("Coach primary actions use the approved green and stronger Team management heading", async () => {
  const css = await readFile(styles, "utf8");

  assert.match(css, /--coach-action:\s*#0bcf52/);
  assert.match(css, /control-room__section-title[\s\S]*font-size:\s*25px/);
  assert.match(css, /coach-primary-action[\s\S]*background:\s*var\(--coach-action\)/);
});
