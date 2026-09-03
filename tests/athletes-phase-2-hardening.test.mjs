import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sourcePath = "packages/frontend/src/athletes/AthletesPages.tsx";
const page = readFileSync(sourcePath, "utf8");

function reloadSource() {
  const start = page.indexOf("async function reload()");
  const end = page.indexOf("useEffect(() =>", start);
  return page.slice(start, end);
}

test("Athletes detail uses typed member state", () => {
  const typedImport = "import type { AthletesMember, AthletesSport }";
  assert.equal(page.includes(typedImport), true);
  assert.equal(page.includes("useState<AthletesMember[]>([])"), true);
  assert.equal(page.includes("useState<unknown[]>"), false);
});

test("Athletes reload uses the freshly loaded viewer role", () => {
  const reload = reloadSource();
  assert.equal(reload.includes("if (next.viewerRole)"), true);
  assert.equal(reload.includes("detail?.viewerRole"), false);
});

test("join requests load only behind the manager role gate", () => {
  const reload = reloadSource();
  const founder = 'next.viewerRole === "FOUNDER"';
  const moderator = 'next.viewerRole === "MODERATOR"';
  const managerGate = reload.indexOf(`${founder} || ${moderator}`);
  const joinRequests = reload.indexOf("api.athletes.joinRequests");
  assert.ok(managerGate >= 0);
  assert.ok(joinRequests > managerGate);
});
