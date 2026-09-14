import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { PrismaAthletesCalendarRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const db = getDatabaseClient();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("Calendar create waits for Athletes archive and cannot write after archive commits", async () => {
  const athletesRepository = new PrismaAthletesRepository(db);
  const athletesService = new AthletesService(athletesRepository);
  const calendarRepository = new PrismaAthletesCalendarRepository(db);
  const calendarService = new AthletesCalendarService(
    athletesService,
    calendarRepository,
    calendarRepository,
  );
  const founder = await db.user.create({ data: {} });
  let communityId: string | null = null;

  try {
    const community = await athletesService.create(founder.id, {
      name: `Calendar Lock ${Date.now()}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
    });
    communityId = community.id;
    const archived = deferred();
    const release = deferred();

    const archiveTransaction = athletesRepository.withCommunityLock(
      community.id,
      async (scoped) => {
        await new AthletesService(scoped).archive(founder.id, community.id);
        archived.resolve();
        await release.promise;
      },
    );
    void archiveTransaction.catch(archived.resolve);
    await archived.promise;

    const competingCreate = calendarService.create(founder.id, community.id, {
      title: "Must not survive archive",
      startsAt: "2026-09-20T17:00:00.000Z",
      endsAt: "2026-09-20T18:00:00.000Z",
      timezone: "UTC",
    });
    void competingCreate.catch(() => undefined);

    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const rows = await db.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%AthletesCommunity%FOR UPDATE%'
        `;
        if (Number(rows[0]?.count) > 0) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, "Calendar mutation must wait for the Athletes lifecycle lock");
    } finally {
      release.resolve();
      await archiveTransaction;
    }

    await assert.rejects(
      competingCreate,
      (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_NOT_FOUND",
    );
    assert.equal(
      await db.athletesCalendarEntry.count({ where: { athletesCommunityId: community.id } }),
      0,
    );
  } finally {
    if (communityId) await db.athletesCommunity.deleteMany({ where: { id: communityId } });
    await db.user.deleteMany({ where: { id: founder.id } });
    await db.$disconnect();
  }
});
