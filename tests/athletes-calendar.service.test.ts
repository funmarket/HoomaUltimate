import assert from "node:assert/strict";
import test from "node:test";
import type { AthletesCalendarRsvpStatus } from "@hooma/contracts/athletes";
import type { AthletesContentAuthorizer } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import type {
  AthletesCalendarCreateRecordInput,
  AthletesCalendarListRecordInput,
  AthletesCalendarRecord,
  AthletesCalendarRepository,
  AthletesCalendarTransactionRepository,
} from "../apps/api/src/modules/athletes/application/athletes-calendar.repository.js";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import type { AthletesCalendarUnitOfWork } from "../apps/api/src/modules/athletes/application/athletes-calendar.unit-of-work.js";
import type { AthletesRepository } from "../apps/api/src/modules/athletes/application/athletes.repository.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const START = new Date("2026-09-20T17:00:00.000Z");
const END = new Date("2026-09-20T18:00:00.000Z");

function record(overrides: Partial<AthletesCalendarRecord> = {}): AthletesCalendarRecord {
  return {
    id: "entry-1",
    athletesCommunityId: "ath-1",
    title: "Training",
    description: null,
    location: null,
    startsAt: START,
    endsAt: END,
    timezone: "UTC",
    cancelledAt: null,
    createdByUserId: "founder",
    createdAt: new Date("2026-09-13T12:00:00.000Z"),
    updatedAt: new Date("2026-09-13T12:00:00.000Z"),
    ...overrides,
  };
}

function authorizer(memberIds: string[]): AthletesContentAuthorizer {
  return {
    async requireMemberContent(userId) {
      if (!memberIds.includes(userId)) {
        throw new AthletesError("ATHLETES_MEMBER_REQUIRED", "Athletes membership required");
      }
    },
    async requireFounderContent() {},
  };
}

function athletesScope(
  founderId = "founder",
  memberIds: readonly string[] = ["member"],
): AthletesRepository {
  const roleFor = (userId: string) => {
    if (userId === founderId) return "FOUNDER" as const;
    if (memberIds.includes(userId)) return "MEMBER" as const;
    return null;
  };
  return {
    lifecycle: async (id) => ({
      id,
      slug: id,
      name: "Community",
      sport: "RUNNING",
      description: null,
      city: null,
      houma: null,
      logoUrl: null,
      bannerUrl: null,
      visibility: "PRIVATE",
      joinPolicy: "APPROVAL_REQUIRED",
      status: "ACTIVE",
      createdByUserId: founderId,
      createdAt: START,
      updatedAt: START,
    }),
    managerRole: async (_id, userId) => roleFor(userId),
    activeRole: async (_id, userId) => roleFor(userId),
  } as unknown as AthletesRepository;
}

type StoredRsvp = {
  calendarEntryId: string;
  userId: string;
  status: AthletesCalendarRsvpStatus;
};

function harness(initial: AthletesCalendarRecord[] = []) {
  const rows = [...initial];
  const rsvps = new Map<string, StoredRsvp>();
  let exclusiveLockCalls = 0;
  let sharedLockCalls = 0;
  let listCalls = 0;
  const repository: AthletesCalendarRepository = {
    async listForCommunity(
      athletesCommunityId,
      input: AthletesCalendarListRecordInput,
      viewerUserId,
    ) {
      listCalls += 1;
      const matching = rows
        .filter(
          (row) =>
            row.athletesCommunityId === athletesCommunityId &&
            row.startsAt < input.range.to &&
            row.endsAt > input.range.from,
        )
        .sort(
          (left, right) =>
            left.startsAt.getTime() - right.startsAt.getTime() || left.id.localeCompare(right.id),
        );
      const start = input.cursor ? matching.findIndex((row) => row.id === input.cursor) + 1 : 0;
      const pageRows = matching.slice(start, start + input.limit);
      return {
        items: pageRows.map((entry) => {
          const entryRsvps = [...rsvps.values()].filter(
            (rsvp) => rsvp.calendarEntryId === entry.id,
          );
          return {
            entry,
            viewerStatus: entryRsvps.find((rsvp) => rsvp.userId === viewerUserId)?.status ?? null,
            counts: {
              going: entryRsvps.filter((rsvp) => rsvp.status === "GOING").length,
              maybe: entryRsvps.filter((rsvp) => rsvp.status === "MAYBE").length,
              notGoing: entryRsvps.filter((rsvp) => rsvp.status === "NOT_GOING").length,
            },
          };
        }),
        nextCursor: matching.length > start + input.limit ? (pageRows.at(-1)?.id ?? null) : null,
      };
    },
  };
  const transaction: AthletesCalendarTransactionRepository = {
    async create(input: AthletesCalendarCreateRecordInput) {
      const created = record({
        ...input,
        createdAt: START,
        updatedAt: START,
        cancelledAt: null,
      });
      rows.push(created);
      return created;
    },
    async getForCommunity(athletesCommunityId, entryId) {
      return (
        rows.find((row) => row.athletesCommunityId === athletesCommunityId && row.id === entryId) ??
        null
      );
    },
    async update(athletesCommunityId, entryId, input) {
      const index = rows.findIndex(
        (row) => row.athletesCommunityId === athletesCommunityId && row.id === entryId,
      );
      if (index < 0 || rows[index]!.cancelledAt) return null;
      rows[index] = { ...rows[index]!, ...input, updatedAt: END };
      return rows[index]!;
    },
    async cancel(athletesCommunityId, entryId, cancelledAt) {
      const index = rows.findIndex(
        (row) => row.athletesCommunityId === athletesCommunityId && row.id === entryId,
      );
      if (index < 0) return null;
      rows[index] = { ...rows[index]!, cancelledAt, updatedAt: cancelledAt };
      return rows[index]!;
    },
    async upsertRsvp(input) {
      rsvps.set(`${input.calendarEntryId}:${input.userId}`, {
        calendarEntryId: input.calendarEntryId,
        userId: input.userId,
        status: input.status,
      });
    },
  };
  const unitOfWork: AthletesCalendarUnitOfWork = {
    async withCommunityLock(_athletesCommunityId, operation) {
      exclusiveLockCalls += 1;
      return operation({ athletes: athletesScope(), calendar: transaction });
    },
    async withCommunitySharedLock(_athletesCommunityId, operation) {
      sharedLockCalls += 1;
      return operation({ athletes: athletesScope(), calendar: transaction });
    },
  };
  return {
    rows,
    rsvps,
    repository,
    unitOfWork,
    exclusiveLockCalls: () => exclusiveLockCalls,
    sharedLockCalls: () => sharedLockCalls,
    listCalls: () => listCalls,
  };
}

function expectCode(code: string) {
  return (error: unknown) => error instanceof AthletesError && error.code === code;
}

test("active member Calendar read uses ordinary authorization without a lifecycle lock", async () => {
  const state = harness([record()]);
  const service = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    state.unitOfWork,
  );

  const page = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
  });
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, null);
  assert.equal(state.listCalls(), 1);
  assert.equal(state.exclusiveLockCalls(), 0);
  assert.equal(state.sharedLockCalls(), 0);
  assert.equal("createdByUserId" in page.items[0]!, false);
  assert.deepEqual(page.items[0]!.rsvp, {
    viewerStatus: null,
    counts: { going: 0, maybe: 0, notGoing: 0 },
  });

  await assert.rejects(
    () =>
      service.list("outsider", "ath-1", {
        from: "2026-09-20T00:00:00.000Z",
        to: "2026-09-21T00:00:00.000Z",
      }),
    expectCode("ATHLETES_MEMBER_REQUIRED"),
  );
});

test("Calendar list preserves bounded cursor pages", async () => {
  const state = harness([
    record({ id: "entry-1", startsAt: START }),
    record({ id: "entry-2", startsAt: START }),
    record({ id: "entry-3", startsAt: new Date("2026-09-20T19:00:00.000Z") }),
  ]);
  const service = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    state.unitOfWork,
  );

  const first = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
    limit: 2,
  });
  assert.deepEqual(
    first.items.map((entry) => entry.id),
    ["entry-1", "entry-2"],
  );
  assert.equal(first.nextCursor, "entry-2");

  const second = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
    cursor: first.nextCursor!,
    limit: 2,
  });
  assert.deepEqual(
    second.items.map((entry) => entry.id),
    ["entry-3"],
  );
  assert.equal(second.nextCursor, null);
});

test("Founder Calendar mutations keep the exclusive Athletes lifecycle lock", async () => {
  const state = harness();
  const service = new AthletesCalendarService(
    authorizer(["founder"]),
    state.repository,
    state.unitOfWork,
  );

  const created = await service.create("founder", "ath-1", {
    title: "Intervals",
    description: null,
    location: "Track",
    startsAt: START.toISOString(),
    endsAt: END.toISOString(),
    timezone: "UTC",
  });
  assert.equal(state.exclusiveLockCalls(), 1);
  assert.equal(state.sharedLockCalls(), 0);

  const updated = await service.update("founder", "ath-1", created.id, {
    title: "Intervals updated",
  });
  assert.equal(state.exclusiveLockCalls(), 2);
  assert.equal(state.sharedLockCalls(), 0);
  assert.equal(updated.title, "Intervals updated");

  const cancelled = await service.cancel("founder", "ath-1", created.id);
  assert.equal(state.exclusiveLockCalls(), 3);
  assert.ok(cancelled.cancelledAt);
  const cancelledAgain = await service.cancel("founder", "ath-1", created.id);
  assert.equal(state.exclusiveLockCalls(), 4);
  assert.equal(state.sharedLockCalls(), 0);
  assert.equal(cancelledAgain.cancelledAt, cancelled.cancelledAt);

  await assert.rejects(
    () => service.update("founder", "ath-1", created.id, { title: "Nope" }),
    expectCode("ATHLETES_CALENDAR_ENTRY_CANCELLED"),
  );
});

test("active members set and change one RSVP row through the shared lifecycle guard", async () => {
  const state = harness([record()]);
  const service = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    state.unitOfWork,
  );

  assert.deepEqual(await service.setRsvp("member", "ath-1", "entry-1", "GOING"), {
    entryId: "entry-1",
    status: "GOING",
  });
  assert.equal(state.rsvps.size, 1);
  assert.equal(state.exclusiveLockCalls(), 0);
  assert.equal(state.sharedLockCalls(), 1);

  let page = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
  });
  assert.equal(page.items[0]!.rsvp.viewerStatus, "GOING");
  assert.deepEqual(page.items[0]!.rsvp.counts, { going: 1, maybe: 0, notGoing: 0 });

  assert.deepEqual(await service.setRsvp("member", "ath-1", "entry-1", "MAYBE"), {
    entryId: "entry-1",
    status: "MAYBE",
  });
  assert.equal(state.rsvps.size, 1);
  assert.equal(state.exclusiveLockCalls(), 0);
  assert.equal(state.sharedLockCalls(), 2);

  page = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
  });
  assert.equal(page.items[0]!.rsvp.viewerStatus, "MAYBE");
  assert.deepEqual(page.items[0]!.rsvp.counts, { going: 0, maybe: 1, notGoing: 0 });
});

test("RSVP rejects outsiders, cancelled entries, and cross-community entry ids", async () => {
  const state = harness([record()]);
  const service = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    state.unitOfWork,
  );

  await assert.rejects(
    () => service.setRsvp("outsider", "ath-1", "entry-1", "GOING"),
    expectCode("ATHLETES_MEMBER_REQUIRED"),
  );
  await assert.rejects(
    () => service.setRsvp("member", "ath-2", "entry-1", "GOING"),
    expectCode("ATHLETES_CALENDAR_ENTRY_NOT_FOUND"),
  );

  state.rows[0] = record({ cancelledAt: START });
  await assert.rejects(
    () => service.setRsvp("member", "ath-1", "entry-1", "NOT_GOING"),
    expectCode("ATHLETES_CALENDAR_ENTRY_CANCELLED"),
  );
  assert.equal(state.rsvps.size, 0);
  assert.equal(state.exclusiveLockCalls(), 0);
  assert.equal(state.sharedLockCalls(), 3);
});

test("non-Founder cannot create and cross-community ids cannot escape scope", async () => {
  const state = harness([record()]);
  const memberScope: AthletesCalendarUnitOfWork = {
    async withCommunityLock(_athletesCommunityId, operation) {
      return operation({
        athletes: athletesScope("someone-else", ["member"]),
        calendar: {
          create: async () => record(),
          getForCommunity: async () => null,
          update: async () => null,
          cancel: async () => null,
          upsertRsvp: async () => {},
        },
      });
    },
    async withCommunitySharedLock(_athletesCommunityId, operation) {
      return operation({
        athletes: athletesScope("someone-else", ["member"]),
        calendar: {
          create: async () => record(),
          getForCommunity: async () => null,
          update: async () => null,
          cancel: async () => null,
          upsertRsvp: async () => {},
        },
      });
    },
  };
  const memberService = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    memberScope,
  );
  await assert.rejects(
    () =>
      memberService.create("member", "ath-1", {
        title: "Forbidden",
        startsAt: START.toISOString(),
        endsAt: END.toISOString(),
        timezone: "UTC",
      }),
    expectCode("ATHLETES_FOUNDER_REQUIRED"),
  );

  const founderService = new AthletesCalendarService(
    authorizer(["founder"]),
    state.repository,
    state.unitOfWork,
  );
  await assert.rejects(
    () => founderService.update("founder", "ath-2", "entry-1", { title: "Cross-scope" }),
    expectCode("ATHLETES_CALENDAR_ENTRY_NOT_FOUND"),
  );
  await assert.rejects(
    () => founderService.cancel("founder", "ath-2", "entry-1"),
    expectCode("ATHLETES_CALENDAR_ENTRY_NOT_FOUND"),
  );
});
