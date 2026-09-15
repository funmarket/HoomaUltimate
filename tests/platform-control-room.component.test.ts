import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminApp = readFileSync("apps/web/src/admin/AdminApp.tsx", "utf8");
const shell = readFileSync("apps/web/src/admin/ControlRoomShell.tsx", "utf8");
const overview = readFileSync("apps/web/src/admin/ControlRoomOverview.tsx", "utf8");
const queues = readFileSync("apps/web/src/admin/ReviewQueues.tsx", "utf8");
const audit = readFileSync("apps/web/src/admin/AuditArchive.tsx", "utf8");
const disputes = readFileSync("apps/web/src/admin/GamerDisputeConsole.tsx", "utf8");
const accountHeader = readFileSync("packages/ui/src/account/HoomaAccountHeader.tsx", "utf8");

// PR 1 is a composition/refactor slice: it must keep canonical APIs and domain workflows in place.
test("Platform Control Room is composed from focused admin modules", () => {
  assert.match(adminApp, /<ControlRoomShell/);
  assert.match(adminApp, /<ControlRoomOverview/);
  assert.match(adminApp, /<ReviewQueues/);
  assert.match(adminApp, /<AccessManagers/);
  assert.match(adminApp, /<ManagedEntities/);
  assert.match(adminApp, /<AuditArchive/);
  assert.doesNotMatch(adminApp, /function QueueSection/);
  assert.doesNotMatch(adminApp, /fetch\(/);
});

test("Needs Attention is queue-backed and does not invent platform health", () => {
  assert.match(overview, /Needs Attention/);
  assert.match(adminApp, /queues\.places\.length/);
  assert.match(adminApp, /queues\["place-ownership"\]\.length/);
  assert.match(adminApp, /queues\.pitch\.length/);
  assert.match(adminApp, /gamerDisputeCount/);
  assert.match(disputes, /onCountChange\?\.\(response\.items\.length\)/);
  assert.doesNotMatch(overview, /Healthy|Database status|Worker status|Storage status/i);
});

test("audit evidence is separated from actionable review queues", () => {
  assert.match(audit, /Audit Archive/);
  assert.match(overview, /Recent Admin Activity/i);
  assert.match(overview, /View Audit Archive/);
  assert.doesNotMatch(queues, /Audit Archive|Recent sensitive actions/);
});

test("authority labels distinguish Platform Admin from delegated App Manager", () => {
  assert.match(shell, /PLATFORM ADMIN/);
  assert.match(shell, /APP MANAGER/);
  assert.match(shell, /Pitch Review/);
  assert.match(shell, /Audit/);
  assert.match(accountHeader, /title="Platform Control Room"/);
});

test("PR 1 does not introduce future control-plane models or capabilities", () => {
  for (const source of [adminApp, shell, overview, queues, audit]) {
    assert.doesNotMatch(source, /AdminIssue|FeatureAvailability|FeatureFlag|MANAGE_USERS|MANAGE_ADMIN_ISSUES/);
  }
});
