import assert from "node:assert/strict";
import test from "node:test";
import {
  athletesCalendarCreateSchema,
  athletesCalendarEntrySchema,
  athletesCalendarEntryViewSchema,
  athletesCalendarListQuerySchema,
  athletesCalendarRsvpInputSchema,
  athletesCalendarUpdateSchema,
} from "@hooma/contracts/athletes";

const start = "2026-09-20T17:00:00.000Z";
const end = "2026-09-20T18:30:00.000Z";

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
      limit: 50,
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
  assert.deepEqual(athletesCalendarEntrySchema.parse(entry), entry);
  assert.throws(() => athletesCalendarEntrySchema.parse({ ...entry, createdByUserId: "founder" }));
});

test("Athletes Calendar RSVP accepts exactly Going, Maybe, and Not going states", () => {
  for (const status of ["GOING", "MAYBE", "NOT_GOING"] as const) {
    assert.deepEqual(athletesCalendarRsvpInputSchema.parse({ status }), { status });
  }
  assert.throws(() => athletesCalendarRsvpInputSchema.parse({ status: "INTERESTED" }));
  assert.throws(() => athletesCalendarRsvpInputSchema.parse({ status: "GOING", extra: true }));
});

test("Athletes Calendar member list projection includes viewer RSVP and aggregate totals", () => {
  const view = {
    ...entry,
    rsvp: {
      viewerStatus: "MAYBE" as const,
      counts: { going: 7, maybe: 2, notGoing: 1 },
    },
  };
  assert.deepEqual(athletesCalendarEntryViewSchema.parse(view), view);
  assert.throws(() =>
    athletesCalendarEntryViewSchema.parse({
      ...view,
      rsvp: { viewerStatus: "INTERESTED", counts: view.rsvp.counts },
    }),
  );
});
