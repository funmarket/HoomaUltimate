import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("apps/api/src/modules/whistle/application/whistle.service.ts", "utf8");
const worker = readFileSync("apps/worker/src/main.ts", "utf8");
const board = readFileSync("packages/frontend/src/whistle/HoomaWhistleBoard.tsx", "utf8");

test("Whistle API reads and writes do not physically delete expired metadata", () => {
  assert.doesNotMatch(service, /deleteExpired/);
});

test("Worker owns bounded Whistle metadata cleanup", () => {
  assert.match(worker, /cleanupExpiredWhistles/);
  assert.match(worker, /WHISTLE_CLEANUP_INTERVAL_MS/);
  assert.doesNotMatch(worker, /10_000/);
});

test("Shared Whistle board backs off instead of polling constantly while hidden or quiet", () => {
  assert.doesNotMatch(board, /setInterval\(\(\) => void load\(true\), REFRESH_INTERVAL_MS\)/);
  assert.match(board, /document\.visibilityState === "hidden"/);
  assert.match(board, /WHISTLE_HIDDEN_REFRESH_INTERVAL_MS/);
  assert.match(board, /WHISTLE_QUIET_REFRESH_INTERVAL_MS/);
  assert.match(board, /setTimeout/);
});
