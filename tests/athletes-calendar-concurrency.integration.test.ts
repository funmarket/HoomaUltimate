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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("Athletes Calendar create cannot race an Athletes archive", async () => {
  const athletesRepository = new PrismaAthletesRepository(db);
  const athletes = new AthletesService(athletesRepository);
  const calendar = new AthletesCalendarService(
    new AthletesContentAuthorization(athletesRepository),
    new PrismaAthletesCalendarRepository(db),
  );
  const founder = await db.user.create({ data: {} });
  let communityId: string | null = null;

  try {
    const community = await athletes.create(founder.id, {
      name: `Calendar Archive Race ${Date.now()}`,
      sport: "RUNNING",
      visibility: "PRIVATE",
      joinPolicy: "OPEN",
    });
    communityId = community.id;

    const archivedInsideTransaction = deferred();
    const releaseArchive = deferred();
    const archiveTransaction = athletesRepository.withCommunityLock(community.id, async (scoped) => {
      await new AthletesService(scoped).archive(founder.id, community.id);
      archivedInsideTransaction.resolve();
      await releaseArchive.promise;
    });
    void archiveTransaction.catch(archivedInsideTransaction.resolve);
    await archivedInsideTransaction.promise;

    const createAttempt = calendar.create(founder.id, community.id, {
      title: "Must not survive archive",
      description: null,
      startsAt: "2026-09-18T17:30:00.000Z",
      endsAt: null,
      timezone: "Africa/Tunis",
      locationName: null,
    });
    void createAttempt.catch(() => undefined);

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
      assert.equal(waiting, true, "calendar create must wait for the Athletes lifecycle lock");
    } finally {
      releaseArchive.resolve();
      await archiveTransaction;
    }

    await assert.rejects(
      createAttempt,
      (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_NOT_FOUND",
    );
    assert.equal(
      await db.athletesCalendarEntry.count({ where: { athletesCommunityId: community.id } }),
      0,
    );
  } finally {
    if (communityId) {
      await db.athletesCalendarEntry.deleteMany({ where: { athletesCommunityId: communityId } });
      await db.athletesCommunity.deleteMany({ where: { id: communityId } });
    }
    await db.user.deleteMany({ where: { id: founder.id } });
    await db.$disconnect();
  }
});
