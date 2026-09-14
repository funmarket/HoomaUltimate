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

function expectCode(code: string) {
  return (error: unknown) => error instanceof AthletesError && error.code === code;
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), 1500);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForSharedLockWait(): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const rows = await db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%AthletesCommunity%FOR SHARE%'
    `;
    if (Number(rows[0]?.count) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("RSVP transaction did not wait for the shared lifecycle guard");
}

test("Athletes Calendar RSVP preserves shared-lock lifecycle safety", async (t) => {
  const athletesRepo = new PrismaAthletesRepository(db);
  const athletes = new AthletesService(athletesRepo);
  const calendarRepo = new PrismaAthletesCalendarRepository(db);
  const calendar = new AthletesCalendarService(athletes, calendarRepo, calendarRepo);
  const users = await Promise.all(Array.from({ length: 5 }, () => db.user.create({ data: {} })));
  const [founder, memberA, memberB, memberC, memberD] = users;
  const communityIds: string[] = [];

  async function fixture(label: string, memberIds: readonly string[]) {
    const community = await athletes.create(founder!.id, {
      name: `RSVP ${label} ${Date.now()} ${communityIds.length}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
    });
    communityIds.push(community.id);

    for (const userId of memberIds) {
      const joined = await athletes.join(userId, community.id);
      assert.equal(joined.status, "JOINED");
    }

    const entry = await calendar.create(founder!.id, community.id, {
      title: `${label} training`,
      startsAt: "2026-09-20T17:00:00.000Z",
      endsAt: "2026-09-20T18:00:00.000Z",
      timezone: "UTC",
    });
    return { community, entry };
  }

  try {
    await t.test("independent RSVPs can hold the shared guard together", async () => {
      const { community, entry } = await fixture("parallel", [memberA!.id, memberB!.id]);
      const acquired = deferred();
      const release = deferred();
      const firstUow = {
        withCommunityLock(id: string, operation: Parameters<typeof calendarRepo.withCommunityLock>[1]) {
          return calendarRepo.withCommunityLock(id, operation);
        },
        withCommunitySharedLock(
          id: string,
          operation: Parameters<typeof calendarRepo.withCommunitySharedLock>[1],
        ) {
          return calendarRepo.withCommunitySharedLock(id, async (scope) => {
            acquired.resolve();
            await release.promise;
            return operation(scope);
          });
        },
      };
      const firstCalendar = new AthletesCalendarService(athletes, calendarRepo, firstUow);
      const first = firstCalendar.setRsvp(memberA!.id, community.id, entry.id, "GOING");
      void first.catch(() => undefined);
      await acquired.promise;

      const second = calendar.setRsvp(memberB!.id, community.id, entry.id, "MAYBE");
      try {
        await withTimeout(second, "independent RSVP blocked behind another shared guard");
      } finally {
        release.resolve();
        await Promise.allSettled([first, second]);
      }

      await first;
      const count = await db.athletesCalendarRsvp.count({
        where: { calendarEntryId: entry.id },
      });
      assert.equal(count, 2);
    });

    await t.test("same-user concurrent updates keep one RSVP row", async () => {
      const { community, entry } = await fixture("same-user", [memberD!.id]);
      await Promise.all([
        calendar.setRsvp(memberD!.id, community.id, entry.id, "GOING"),
        calendar.setRsvp(memberD!.id, community.id, entry.id, "MAYBE"),
      ]);
      const count = await db.athletesCalendarRsvp.count({
        where: { calendarEntryId: entry.id, userId: memberD!.id },
      });
      assert.equal(count, 1);
    });

    await t.test("member removal wins against an in-flight RSVP", async () => {
      const { community, entry } = await fixture("remove", [memberB!.id]);
      const removed = deferred();
      const release = deferred();
      const removal = athletesRepo.withCommunityLock(community.id, async (scoped) => {
        assert.equal(await scoped.removeMember(community.id, memberB!.id), true);
        removed.resolve();
        await release.promise;
      });
      void removal.catch(removed.resolve);
      await removed.promise;

      const rsvp = calendar.setRsvp(memberB!.id, community.id, entry.id, "GOING");
      void rsvp.catch(() => undefined);
      try {
        await waitForSharedLockWait();
      } finally {
        release.resolve();
        await removal;
      }

      await assert.rejects(rsvp, expectCode("ATHLETES_MEMBER_REQUIRED"));
      const count = await db.athletesCalendarRsvp.count({
        where: { calendarEntryId: entry.id, userId: memberB!.id },
      });
      assert.equal(count, 0);
    });

    await t.test("Calendar cancellation wins against an in-flight RSVP", async () => {
      const { community, entry } = await fixture("cancel", [memberC!.id]);
      const cancelled = deferred();
      const release = deferred();
      const cancellingUow = {
        withCommunityLock(
          id: string,
          operation: Parameters<typeof calendarRepo.withCommunityLock>[1],
        ) {
          return calendarRepo.withCommunityLock(id, async (scope) => {
            const result = await operation(scope);
            cancelled.resolve();
            await release.promise;
            return result;
          });
        },
        withCommunitySharedLock(
          id: string,
          operation: Parameters<typeof calendarRepo.withCommunitySharedLock>[1],
        ) {
          return calendarRepo.withCommunitySharedLock(id, operation);
        },
      };
      const cancellingCalendar = new AthletesCalendarService(athletes, calendarRepo, cancellingUow);
      const cancel = cancellingCalendar.cancel(founder!.id, community.id, entry.id);
      void cancel.catch(cancelled.resolve);
      await cancelled.promise;

      const rsvp = calendar.setRsvp(memberC!.id, community.id, entry.id, "GOING");
      void rsvp.catch(() => undefined);
      try {
        await waitForSharedLockWait();
      } finally {
        release.resolve();
        await cancel;
      }

      await assert.rejects(rsvp, expectCode("ATHLETES_CALENDAR_ENTRY_CANCELLED"));
      const count = await db.athletesCalendarRsvp.count({
        where: { calendarEntryId: entry.id, userId: memberC!.id },
      });
      assert.equal(count, 0);
    });

    await t.test("community archive wins against an in-flight RSVP", async () => {
      const { community, entry } = await fixture("archive", [memberA!.id]);
      const archived = deferred();
      const release = deferred();
      const archive = athletesRepo.withCommunityLock(community.id, async (scoped) => {
        assert.equal(await scoped.archive(community.id), true);
        archived.resolve();
        await release.promise;
      });
      void archive.catch(archived.resolve);
      await archived.promise;

      const rsvp = calendar.setRsvp(memberA!.id, community.id, entry.id, "GOING");
      void rsvp.catch(() => undefined);
      try {
        await waitForSharedLockWait();
      } finally {
        release.resolve();
        await archive;
      }

      await assert.rejects(rsvp, expectCode("ATHLETES_MEMBER_REQUIRED"));
      const count = await db.athletesCalendarRsvp.count({
        where: { calendarEntryId: entry.id, userId: memberA!.id },
      });
      assert.equal(count, 0);
    });
  } finally {
    await db.athletesCommunity.deleteMany({ where: { id: { in: communityIds } } });
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await db.$disconnect();
  }
});
