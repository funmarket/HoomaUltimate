import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETES_CALENDAR_MAX_RANGE_DAYS,
  athletesCalendarEntryCreateSchema,
  athletesCalendarEntrySchema,
  athletesCalendarRangeSchema,
  athletesCalendarTimezoneSchema,
} from "@hooma/contracts/athletes-calendar";

test("Athletes Calendar accepts a bounded event and applies the canonical timezone", () => {
  const parsed = athletesCalendarEntryCreateSchema.parse({
    title: "Evening training",
    description: "Bring water.",
    startsAt: "2026-09-18T17:30:00.000Z",
    endsAt: "2026-09-18T19:00:00.000Z",
    locationName: "Municipal Stadium",
  });

  assert.equal(parsed.timezone, "Africa/Tunis");
  assert.equal(parsed.title, "Evening training");
  assert.equal(athletesCalendarTimezoneSchema.parse("Europe/Rome"), "Europe/Rome");
  assert.throws(() => athletesCalendarTimezoneSchema.parse("Not/A_Timezone"));
});

test("Athletes Calendar rejects invalid event timing and unrelated product fields", () => {
  const base = {
    title: "Training",
    startsAt: "2026-09-18T18:00:00.000Z",
    endsAt: "2026-09-18T17:00:00.000Z",
  };
  assert.throws(() => athletesCalendarEntryCreateSchema.parse(base));
  assert.throws(() =>
    athletesCalendarEntryCreateSchema.parse({
      ...base,
      endsAt: "2026-09-18T19:00:00.000Z",
      rsvp: true,
    }),
  );
  assert.throws(() =>
    athletesCalendarEntryCreateSchema.parse({
      ...base,
      endsAt: "2026-09-18T19:00:00.000Z",
      timezone: "Invalid/Timezone",
    }),
  );
});

test("Athletes Calendar range is forward-only and capped for month-grid reads", () => {
  const from = new Date("2026-09-01T00:00:00.000Z");
  const allowedTo = new Date(from);
  allowedTo.setUTCDate(allowedTo.getUTCDate() + ATHLETES_CALENDAR_MAX_RANGE_DAYS);
  assert.doesNotThrow(() =>
    athletesCalendarRangeSchema.parse({ from: from.toISOString(), to: allowedTo.toISOString() }),
  );

  const tooFar = new Date(allowedTo);
  tooFar.setUTCDate(tooFar.getUTCDate() + 1);
  assert.throws(() =>
    athletesCalendarRangeSchema.parse({ from: from.toISOString(), to: tooFar.toISOString() }),
  );
  assert.throws(() =>
    athletesCalendarRangeSchema.parse({ from: from.toISOString(), to: from.toISOString() }),
  );
});

test("Athletes Calendar response hides creator identity and RSVP-style fields", () => {
  const entry = {
    id: "calendar-1",
    athletesCommunityId: "athletes-1",
    title: "Recovery run",
    description: null,
    startsAt: "2026-09-18T06:00:00.000Z",
    endsAt: null,
    timezone: "Africa/Tunis",
    locationName: null,
    status: "SCHEDULED" as const,
    cancelledAt: null,
    createdAt: "2026-09-12T10:00:00.000Z",
    updatedAt: "2026-09-12T10:00:00.000Z",
  };
  assert.deepEqual(athletesCalendarEntrySchema.parse(entry), entry);
  assert.throws(() =>
    athletesCalendarEntrySchema.parse({ ...entry, createdByUserId: "founder-1" }),
  );
  assert.throws(() => athletesCalendarEntrySchema.parse({ ...entry, attendees: [] }));
});
