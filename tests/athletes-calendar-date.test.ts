import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthDays,
  dateKeyForInstant,
  localDateTimeToIso,
  monthQueryRange,
} from "../packages/frontend/src/athletes/calendar/date.js";

test("Athletes Calendar builds a six-week Monday-first phone grid", () => {
  const days = buildMonthDays("2026-09-01");
  assert.equal(days.length, 42);
  assert.equal(days[0]?.key, "2026-08-31");
  assert.equal(days[41]?.key, "2026-10-11");
  assert.equal(days.find((day) => day.key === "2026-09-12")?.inMonth, true);
});

test("Athletes Calendar converts Tunisia wall time to the correct UTC instant", () => {
  assert.equal(
    localDateTimeToIso("2026-09-18", "18:30", "Africa/Tunis"),
    "2026-09-18T17:30:00.000Z",
  );
  assert.equal(
    dateKeyForInstant("2026-09-18T23:30:00.000Z", "Africa/Tunis"),
    "2026-09-19",
  );
});

test("Athletes Calendar month query covers only the visible 42-day grid", () => {
  const range = monthQueryRange("2026-09-01", "Africa/Tunis");
  assert.equal(range.from, "2026-08-30T23:00:00.000Z");
  assert.equal(range.to, "2026-10-11T23:00:00.000Z");
  assert.equal((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000, 42);
});
