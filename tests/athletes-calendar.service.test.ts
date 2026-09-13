import assert from "node:assert/strict";
import test from "node:test";
import type { AthletesContentAuthorizer } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import type {
  AthletesCalendarCreateRecordInput,
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

function athletesScope(founderId = "founder"): AthletesRepository {
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
    managerRole: async (_id, userId) => (userId === founderId ? "FOUNDER" : "MEMBER"),
  } as unknown as AthletesRepository;
}

function harness(initial: AthletesCalendarRecord[] = []) {
  const rows = [...initial];
  let lockCalls = 0;
  let listCalls = 0;
  const repository: AthletesCalendarRepository = {
    async listForCommunity(athletesCommunityId, range) {
      listCalls += 1;
      return rows.filter(
        (row) =>
          row.athletesCommunityId === athletesCommunityId &&
          row.startsAt < range.to &&
          row.endsAt > range.from,
      );
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
  };
  const unitOfWork: AthletesCalendarUnitOfWork = {
    async withCommunityLock(_athletesCommunityId, operation) {
      lockCalls += 1;
      return operation({ athletes: athletesScope(), calendar: transaction });
    },
  };
  return {
    rows,
    repository,
    unitOfWork,
    lockCalls: () => lockCalls,
    listCalls: () => listCalls,
  };
}

function expectCode(code: string) {
  return (error: unknown) => error instanceof AthletesError && error.code === code;
}

test("active member Calendar read uses ordinary authorization without the mutation lock", async () => {
  const state = harness([record()]);
  const service = new AthletesCalendarService(
    authorizer(["member"]),
    state.repository,
    state.unitOfWork,
  );

  const entries = await service.list("member", "ath-1", {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-09-21T00:00:00.000Z",
  });
  assert.equal(entries.length, 1);
  assert.equal(state.listCalls(), 1);
  assert.equal(state.lockCalls(), 0);
  assert.equal("createdByUserId" in entries[0]!, false);

  await assert.rejects(
    () =>
      service.list("outsider", "ath-1", {
        from: "2026-09-20T00:00:00.000Z",
        to: "2026-09-21T00:00:00.000Z",
      }),
    expectCode("ATHLETES_MEMBER_REQUIRED"),
  );
});

test("Founder mutations execute inside the Athletes lifecycle lock", async () => {
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
  assert.equal(state.lockCalls(), 1);
  assert.equal(created.title, "Intervals");

  const updated = await service.update("founder", "ath-1", created.id, {
    title: "Intervals updated",
  });
  assert.equal(state.lockCalls(), 2);
  assert.equal(updated.title, "Intervals updated");

  const cancelled = await service.cancel("founder", "ath-1", created.id);
  assert.equal(state.lockCalls(), 3);
  assert.ok(cancelled.cancelledAt);
  const cancelledAgain = await service.cancel("founder", "ath-1", created.id);
  assert.equal(state.lockCalls(), 4);
  assert.equal(cancelledAgain.cancelledAt, cancelled.cancelledAt);

  await assert.rejects(
    () => service.update("founder", "ath-1", created.id, { title: "Nope" }),
    expectCode("ATHLETES_CALENDAR_ENTRY_CANCELLED"),
  );
});

test("non-Founder cannot mutate and cross-community ids cannot escape scope", async () => {
  const state = harness([record()]);
  const memberScope: AthletesCalendarUnitOfWork = {
    async withCommunityLock(_athletesCommunityId, operation) {
      return operation({
        athletes: athletesScope("someone-else"),
        calendar: {
          create: async () => record(),
          getForCommunity: async () => null,
          update: async () => null,
          cancel: async () => null,
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
