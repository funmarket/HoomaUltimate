import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import { AthletesContentAuthorization } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";
import { PrismaAthletesCalendarRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";

const db = getDatabaseClient();

test("Athletes Calendar enforces membership, Founder writes, isolation and lifecycle", async () => {
  const athletesRepository = new PrismaAthletesRepository(db);
  const athletes = new AthletesService(athletesRepository);
  const calendar = new AthletesCalendarService(
    new AthletesContentAuthorization(athletesRepository),
    new PrismaAthletesCalendarRepository(db),
  );
  const users = await Promise.all(Array.from({ length: 3 }, () => db.user.create({ data: {} })));
  const [founder, member, outsider] = users.map((user) => user.id);
  assert.ok(founder && member && outsider);
  const communityIds: string[] = [];

  try {
    const first = await athletes.create(founder, {
      name: `Calendar Athletes ${Date.now()}`,
      sport: "RUNNING",
      visibility: "PRIVATE",
      joinPolicy: "OPEN",
    });
    const second = await athletes.create(founder, {
      name: `Calendar Isolation ${Date.now()}`,
      sport: "CYCLING",
      visibility: "PRIVATE",
      joinPolicy: "OPEN",
    });
    communityIds.push(first.id, second.id);
    await athletes.join(member, first.id);

    const created = await calendar.create(founder, first.id, {
      title: "Evening training",
      description: "Intervals",
      startsAt: "2026-09-18T17:30:00.000Z",
      endsAt: "2026-09-18T19:00:00.000Z",
      timezone: "Africa/Tunis",
      locationName: "Municipal Stadium",
    });

    const visible = await calendar.list(member, first.id, {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    assert.deepEqual(visible.map((entry) => entry.id), [created.id]);

    await assert.rejects(
      () =>
        calendar.list(outsider, first.id, {
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-10-01T00:00:00.000Z",
        }),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_MEMBER_REQUIRED",
    );
    await assert.rejects(
      () => calendar.create(member, first.id, { ...created, title: "Forbidden" }),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_REQUIRED",
    );
    await assert.rejects(
      () => calendar.update(founder, second.id, created.id, { ...created, title: "Wrong group" }),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
    );

    const updated = await calendar.update(founder, first.id, created.id, {
      title: "Evening intervals",
      description: created.description,
      startsAt: created.startsAt,
      endsAt: created.endsAt,
      timezone: created.timezone,
      locationName: created.locationName,
    });
    assert.equal(updated.title, "Evening intervals");

    const cancelled = await calendar.cancel(founder, first.id, created.id);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal((await calendar.cancel(founder, first.id, created.id)).status, "CANCELLED");
    await assert.rejects(
      () => calendar.update(founder, first.id, created.id, { ...updated, title: "Too late" }),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_CALENDAR_ENTRY_NOT_EDITABLE",
    );

    await athletes.archive(founder, first.id);
    await assert.rejects(
      () =>
        calendar.list(member, first.id, {
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-10-01T00:00:00.000Z",
        }),
      (error: unknown) => error instanceof AthletesError,
    );
  } finally {
    await db.athletesCalendarEntry.deleteMany({ where: { athletesCommunityId: { in: communityIds } } });
    await db.athletesCommunity.deleteMany({ where: { id: { in: communityIds } } });
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await db.$disconnect();
  }
});
