import assert from "node:assert/strict";
import test from "node:test";
import {
  athletesCalendarCreateSchema,
  athletesCalendarEntrySchema,
  athletesCalendarListQuerySchema,
  athletesCalendarUpdateSchema,
} from "@hooma/contracts/athletes";

const start = "2026-09-20T17:00:00.000Z";
const end = "2026-09-20T18:30:00.000Z";

test("Athletes Calendar contracts accept a valid IANA timezone and bounded interval", () => {
  const parsed = athletesCalendarCreateSchema.parse({
    title: "Evening run",
    description: "Easy pace",
    location: "Park entrance",
    startsAt: start,
    endsAt: end,
    timezone: "Europe/Paris",
  });
  assert.equal(parsed.timezone, "Europe/Paris");
  assert.equal(parsed.title, "Evening run");
});

test("Athletes Calendar contracts reject invalid timezone and time ordering", () => {
  assert.throws(() =>
    athletesCalendarCreateSchema.parse({
      title: "Broken",
      startsAt: start,
      endsAt: end,
      timezone: "Not/A_Real_Timezone",
    }),
  );
  assert.throws(() =>
    athletesCalendarCreateSchema.parse({
      title: "Broken",
      startsAt: end,
      endsAt: start,
      timezone: "UTC",
    }),
  );
  assert.throws(() =>
    athletesCalendarUpdateSchema.parse({
      startsAt: end,
      endsAt: start,
    }),
  );
});

test("Athletes Calendar list range is positive and capped at 45 days", () => {
  assert.deepEqual(
    athletesCalendarListQuerySchema.parse({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-16T00:00:00.000Z",
    }),
    {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-16T00:00:00.000Z",
    },
  );
  assert.throws(() =>
    athletesCalendarListQuerySchema.parse({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-16T00:00:00.001Z",
    }),
  );
  assert.throws(() =>
    athletesCalendarListQuerySchema.parse({
      from: end,
      to: start,
    }),
  );
});

test("Athletes Calendar API projection excludes internal creator identity", () => {
  const entry = {
    id: "calendar-1",
    athletesCommunityId: "ath-1",
    title: "Training",
    description: null,
    location: null,
    startsAt: start,
    endsAt: end,
    timezone: "UTC",
    cancelledAt: null,
    createdAt: "2026-09-13T12:00:00.000Z",
    updatedAt: "2026-09-13T12:00:00.000Z",
  };
  assert.deepEqual(athletesCalendarEntrySchema.parse(entry), entry);
  assert.throws(() => athletesCalendarEntrySchema.parse({ ...entry, createdByUserId: "founder" }));
});
