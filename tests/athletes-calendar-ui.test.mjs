import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const calendar = readFileSync(
  "packages/frontend/src/athletes/calendar/AthletesCalendar.tsx",
  "utf8",
);
const grid = readFileSync("packages/frontend/src/athletes/calendar/MonthGrid.tsx", "utf8");
const css = readFileSync(
  "packages/frontend/src/athletes/calendar/athletes-calendar-grid.css",
  "utf8",
);

test("Athletes member content keeps Calendar then Photo Board then Whistle Board", () => {
  const calendarPosition = pages.indexOf("<AthletesCalendar");
  const photoPosition = pages.indexOf("<AthletesPhotoBoard");
  const whistlePosition = pages.indexOf("<AthletesWhistleBoard");

  assert.ok(calendarPosition >= 0, "Calendar should be mounted for Athletes members");
  assert.ok(photoPosition > calendarPosition, "Photo Board should follow Calendar");
  assert.ok(whistlePosition > photoPosition, "Whistle Board should follow Photo Board");
});

test("Athletes Calendar is phone-first month plus selected-day agenda", () => {
  assert.match(calendar, /<MonthGrid/);
  assert.match(calendar, /<DayAgenda/);
  assert.match(calendar, />Today</);
  assert.match(grid, /const WEEKDAYS = \["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"\]/);
  assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(css, /min-height: 2\.9rem;/);
  assert.doesNotMatch(calendar, /WeekView|hourly|time-grid/);
});

test("Athletes Calendar creation is Founder-only in the rendered surface", () => {
  assert.match(calendar, /\{founder \? \(/);
  assert.match(calendar, />\s*Event\s*<\/button>/);
});
