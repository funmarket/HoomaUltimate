import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");

test("Athletes detail uses typed member state", () => {
  assert.match(page, /import type \{ AthletesMember, AthletesSport \}/);
  assert.match(page, /useState<AthletesMember\[\]>\(\[\]\)/);
  assert.doesNotMatch(page, /useState<unknown\[\]>/);
});

test("Athletes detail gates private data from the freshly loaded viewer role", () => {
  assert.match(page, /if \(next\.viewerRole\) \{/);
  assert.match(page, /if \(next\.viewerRole === "FOUNDER" \|\| next\.viewerRole === "MODERATOR"\) \{/);

  const reloadStart = page.indexOf("async function reload()");
  const reloadEnd = page.indexOf("useEffect(() =>", reloadStart);
  const reload = page.slice(reloadStart, reloadEnd);
  assert.doesNotMatch(reload, /detail\?\.viewerRole/);
});

test("ordinary members do not trigger manager-only join request loading", () => {
  const reloadStart = page.indexOf("async function reload()");
  const reloadEnd = page.indexOf("useEffect(() =>", reloadStart);
  const reload = page.slice(reloadStart, reloadEnd);
  const managerGate = reload.indexOf('next.viewerRole === "FOUNDER" || next.viewerRole === "MODERATOR"');
  const joinRequests = reload.indexOf("api.athletes.joinRequests", managerGate);

  assert.ok(managerGate >= 0, "expected manager role gate");
  assert.ok(joinRequests > managerGate, "join requests must be loaded only inside manager gate");
});
