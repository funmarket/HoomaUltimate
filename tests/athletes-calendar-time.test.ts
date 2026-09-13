import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarMonthCells,
  dateKeyForInstant,
  deviceTimezone,
  monthFetchRange,
  shiftMonth,
} from "../packages/frontend/src/athletes/athletes-calendar-time";

test("Athletes Calendar resolves a valid device IANA timezone with UTC fallback semantics", () => {
  const timezone = deviceTimezone();
  assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: timezone }));
});

test("Athletes Calendar groups instants in the viewer timezone", () => {
  const instant = "2026-09-14T00:30:00.000Z";
  assert.equal(dateKeyForInstant(instant, "UTC"), "2026-09-14");
  assert.equal(dateKeyForInstant(instant, "America/New_York"), "2026-09-13");
});

test("Athletes Calendar month helpers stay bounded and deterministic", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(calendarMonthCells("2026-09").filter(Boolean).length, 30);
  const range = monthFetchRange("2026-09");
  const spanDays = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
  assert.ok(spanDays > 30 && spanDays < 45);
});
