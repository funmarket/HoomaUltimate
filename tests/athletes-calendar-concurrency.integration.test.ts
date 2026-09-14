import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import type {
  UserLastSeenReader,
} from "../apps/api/src/modules/identity/application/user-last-seen.reader.js";
import type {
  AthletesCalendarUnitOfWork,
} from "../apps/api/src/modules/athletes/application/athletes-calendar.unit-of-work.js";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { PrismaAthletesCalendarRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-calendar.repository.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const db = getDatabaseClient();
const userLastSeenReader: UserLastSeenReader = {
  async findLastSeenByUserIds(userIds) {
    return new Map(userIds.map((userId) => [userId, null]));
  },
};

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

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForSharedLifecycleWait(): Promise<void> {
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
  assert.fail("RSVP transaction did not wait on the Athletes shared lifecycle guard");
}

test(
  "Athletes Calendar RSVP shared lifecycle guard preserves concurrency and destructive lifecycle safety",
  async (t) => {
    const athletesRepository = new PrismaAthletesRepository(db);
    const athletesService = new AthletesService(athletesRepository, userLastSeenReader);
    const calendarRepository = new PrismaAthletesCalendarRepository(db);
    const calendarService = new AthletesCalendarService(
      athletesService,
      calendarRepository,
      calendarRepository,
    );
    const users = await Promise.all(
      Array.from({ length: 5 }, () => db.user.create({ data: {} })),
    );
    const [founder, memberA, memberB, memberC, memberD] = users;
    const communityIds: string[] = [];

    async function fixture(label: string, memberIds: readonly string[]) {
      const community = await athletesService.create(founder!.id, {
        name: `RSVP ${label} ${Date.now()} ${communityIds.length}`,
        sport: "RUNNING",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
      });
      communityIds.push(community.id);
      for (const userId of memberIds) {
        const joined = await athletesService.join(userId, community.id);
        assert.equal(joined.status, "JOINED");
      }
      const entry = await calendarService.create(founder!.id, community.id, {
        title: `${label} training`,
        startsAt: "2026-09-20T17:00:00.000Z",
        endsAt: "2026-09-20T18:00:00.000Z",
        timezone: "UTC",
      });
      return { community, entry };
    }

    try {
      await t.test(
        "two independent RSVP transactions can hold the shared guard concurrently",
        async () => {
          const { community, entry } = await fixture("parallel", [memberA!.id, memberB!.id]);
          const firstAcquired = deferred();
          const releaseFirst = deferred();
          const firstUow: AthletesCalendarUnitOfWork = {
            withCommunityLock(id, operation) {
              return calendarRepository.withCommunityLock(id, operation);
            },
            withCommunitySharedLock(id, operation) {
              return calendarRepository.withCommunitySharedLock(id, async (scope) => {
                firstAcquired.resolve();
                await releaseFirst.promise;
                return operation(scope);
              });
            },
          };
          const firstService = new AthletesCalendarService(
            athletesService,
            calendarRepository,
            firstUow,
          );
          const firstRsvp = firstService.setRsvp(
            memberA!.id,
            community.id,
            entry.id,
            "GOING",
          );
          void firstRsvp.catch(() => undefined);
          await firstAcquired.promise;

          const secondRsvp = calendarService.setRsvp(
            memberB!.id,
            community.id,
            entry.id,
            "MAYBE",
          );
          try {
            await withTimeout(
              secondRsvp,
              1500,
              "independent RSVP was blocked by another shared Athletes lifecycle guard",
            );
          } finally {
            releaseFirst.resolve();
            await Promise.allSettled([firstRsvp, secondRsvp]);
          }
          await firstRsvp;
          assert.equal(
            await db.athletesCalendarRsvp.count({ where: { calendarEntryId: entry.id } }),
            2,
          );
        },
      );

      await t.test("same-user concurrent RSVP updates still leave one durable row", async () => {
        const { community, entry } = await fixture("same-user", [memberD!.id]);
        await Promise.all([
          calendarService.setRsvp(memberD!.id, community.id, entry.id, "GOING"),
          calendarService.setRsvp(memberD!.id, community.id, entry.id, "MAYBE"),
        ]);
        assert.equal(
          await db.athletesCalendarRsvp.count({
            where: { calendarEntryId: entry.id, userId: memberD!.id },
          }),
          1,
        );
      });

      await t.test(
        "member removal blocks an in-flight RSVP until authority is rechecked",
        async () => {
          const { community, entry } = await fixture("remove", [memberB!.id]);
          const removed = deferred();
          const releaseRemoval = deferred();
          const removalTransaction = athletesRepository.withCommunityLock(
            community.id,
            async (scoped) => {
              assert.equal(await scoped.removeMember(community.id, memberB!.id), true);
              removed.resolve();
              await releaseRemoval.promise;
            },
          );
          void removalTransaction.catch(removed.resolve);
          await removed.promise;

          const competingRsvp = calendarService.setRsvp(
            memberB!.id,
            community.id,
            entry.id,
            "GOING",
          );
          void competingRsvp.catch(() => undefined);
          try {
            await waitForSharedLifecycleWait();
          } finally {
            releaseRemoval.resolve();
            await removalTransaction;
          }

          await assert.rejects(competingRsvp, expectCode("ATHLETES_MEMBER_REQUIRED"));
          assert.equal(
            await db.athletesCalendarRsvp.count({
              where: { calendarEntryId: entry.id, userId: memberB!.id },
            }),
            0,
          );
        },
      );

      await t.test(
        "Calendar cancellation blocks an in-flight RSVP and wins before the RSVP recheck",
        async () => {
          const { community, entry } = await fixture("cancel", [memberC!.id]);
          const cancelledInsideTransaction = deferred();
          const releaseCancellation = deferred();
          const cancellingUow: AthletesCalendarUnitOfWork = {
            withCommunityLock(id, operation) {
              return calendarRepository.withCommunityLock(id, async (scope) => {
                const result = await operation(scope);
                cancelledInsideTransaction.resolve();
                await releaseCancellation.promise;
                return result;
              });
            },
            withCommunitySharedLock(id, operation) {
              return calendarRepository.withCommunitySharedLock(id, operation);
            },
          };
          const cancellingService = new AthletesCalendarService(
            athletesService,
            calendarRepository,
            cancellingUow,
          );
          const cancelPromise = cancellingService.cancel(founder!.id, community.id, entry.id);
          void cancelPromise.catch(cancelledInsideTransaction.resolve);
          await cancelledInsideTransaction.promise;

          const competingRsvp = calendarService.setRsvp(
            memberC!.id,
            community.id,
            entry.id,
            "GOING",
          );
          void competingRsvp.catch(() => undefined);
          try {
            await waitForSharedLifecycleWait();
          } finally {
            releaseCancellation.resolve();
            await cancelPromise;
          }

          await assert.rejects(
            competingRsvp,
            expectCode("ATHLETES_CALENDAR_ENTRY_CANCELLED"),
          );
          assert.equal(
            await db.athletesCalendarRsvp.count({
              where: { calendarEntryId: entry.id, userId: memberC!.id },
            }),
            0,
          );
        },
      );

      await t.test(
        "community archive blocks an in-flight RSVP and prevents a post-archive write",
        async () => {
          const { community, entry } = await fixture("archive", [memberA!.id]);
          const archivedInsideTransaction = deferred();
          const releaseArchive = deferred();
          const archiveTransaction = athletesRepository.withCommunityLock(
            community.id,
            async (scoped) => {
              assert.equal(await scoped.archive(community.id), true);
              archivedInsideTransaction.resolve();
              await releaseArchive.promise;
            },
          );
          void archiveTransaction.catch(archivedInsideTransaction.resolve);
          await archivedInsideTransaction.promise;

          const competingRsvp = calendarService.setRsvp(
            memberA!.id,
            community.id,
            entry.id,
            "GOING",
          );
          void competingRsvp.catch(() => undefined);
          try {
            await waitForSharedLifecycleWait();
          } finally {
            releaseArchive.resolve();
            await archiveTransaction;
          }

          await assert.rejects(competingRsvp, expectCode("ATHLETES_MEMBER_REQUIRED"));
          assert.equal(
            await db.athletesCalendarRsvp.count({
              where: { calendarEntryId: entry.id, userId: memberA!.id },
            }),
            0,
          );
        },
      );
    } finally {
      await db.athletesCommunity.deleteMany({ where: { id: { in: communityIds } } });
      await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
      await db.$disconnect();
    }
  },
);
