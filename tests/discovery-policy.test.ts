import assert from "node:assert/strict";
import test from "node:test";
import { classifyTimedActivity } from "../apps/api/src/modules/discovery/domain/discovery-policy.js";

const now = new Date("2026-08-24T20:00:00.000Z");

function at(minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

test("HOOMA NOW promotes imminent and live activities with deterministic urgency", () => {
  assert.equal(classifyTimedActivity(now, at(45), null), "UPCOMING");
  assert.equal(classifyTimedActivity(now, at(20), null), "STARTING_SOON");
  assert.equal(classifyTimedActivity(now, at(-8), null), "JUST_STARTED");
  assert.equal(classifyTimedActivity(now, at(-25), at(35)), "LIVE_NOW");
  assert.equal(classifyTimedActivity(now, at(-50), at(12)), "ENDING_SOON");
  assert.equal(classifyTimedActivity(now, at(-55), at(4)), "FINAL_MINUTES");
});

test("HOOMA NOW does not pretend an unbounded activity is still live", () => {
  assert.equal(classifyTimedActivity(now, at(-16), null), null);
  assert.equal(classifyTimedActivity(now, at(-60), at(-1)), null);
});
