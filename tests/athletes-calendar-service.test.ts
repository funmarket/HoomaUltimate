import assert from "node:assert/strict";
import test from "node:test";
import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
} from "@hooma/contracts/athletes-calendar";
import type { AthletesContentAuthorizer } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import type { AthletesCalendarRepository } from "../apps/api/src/modules/athletes/application/athletes-calendar.repository.js";
import { AthletesCalendarService } from "../apps/api/src/modules/athletes/application/athletes-calendar.service.js";
import type {
  AthletesCalendarTransactionRepository,
  AthletesCalendarTransactionScope,
  AthletesCalendarUnitOfWork,
} from "../apps/api/src/modules/athletes/application/athletes-calendar.unit-of-work.js";
import type { AthletesRepository } from "../apps/api/src/modules/athletes/application/athletes.repository.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const ENTRY: AthletesCalendarEntry = {
  id: "calendar-1",
  athletesCommunityId: "athletes-1",
  title: "Training",
  description: null,
  startsAt: "2026-09-18T17:00:00.000Z",
  endsAt: null,
  timezone: "Africa/Tunis",
  locationName: null,
  status: "SCHEDULED",
  cancelledAt: null,
  createdAt: "2026-09-12T10:00:00.000Z",
  updatedAt: "2026-09-12T10:00:00.000Z",
};

const WRITE: AthletesCalendarEntryCreateInput = {
  title: "Training",
  description: null,
  startsAt: ENTRY.startsAt,
  endsAt: null,
  timezone: ENTRY.timezone,
  locationName: null,
};

class FakeAuthorizer implements AthletesContentAuthorizer {
  memberChecks: string[] = [];
  founderChecks: string[] = [];

  async requireMemberContent(_userId: string, athletesCommunityId: string) {
    this.memberChecks.push(athletesCommunityId);
  }

  async requireFounderContent(_userId: string, athletesCommunityId: string) {
    this.founderChecks.push(athletesCommunityId);
  }
}

class FakePersistence
  implements
    AthletesCalendarRepository,
    AthletesCalendarUnitOfWork,
    AthletesCalendarTransactionRepository
{
  calls: string[] = [];
  lockedRole: "FOUNDER" | "MEMBER" = "FOUNDER";

  async listForCommunity() {
    this.calls.push("list");
    return [ENTRY];
  }

  async create(
    _communityId: string,
    _createdByUserId: string,
    _input: AthletesCalendarEntryCreateInput,
  ) {
    this.calls.push("create");
    return ENTRY;
  }

  async update(_communityId: string, _entryId: string, _input: AthletesCalendarEntryUpdateInput) {
    this.calls.push("update");
    return ENTRY;
  }

  async cancel() {
    this.calls.push("cancel");
    return { ...ENTRY, status: "CANCELLED" as const };
  }

  async withCommunityLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesCalendarTransactionScope) => Promise<T>,
  ) {
    this.calls.push("lock");
    const role = this.lockedRole;
    const athletes = {
      lifecycle: async () => ({
        id: athletesCommunityId,
        slug: "athletes-1",
        name: "Athletes One",
        sport: "RUNNING",
        description: null,
        city: null,
        houma: null,
        logoUrl: null,
        bannerUrl: null,
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
        status: "ACTIVE",
        createdByUserId: "founder-1",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      managerRole: async () => role,
    } as unknown as AthletesRepository;
    return operation({ athletes, calendar: this });
  }
}

test("Athletes Calendar reads require active member authorization", async () => {
  const authorizer = new FakeAuthorizer();
  const persistence = new FakePersistence();
  const service = new AthletesCalendarService(authorizer, persistence);

  const result = await service.list("member-1", "athletes-1", {
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-10-01T00:00:00.000Z",
  });

  assert.deepEqual(result, [ENTRY]);
  assert.deepEqual(authorizer.memberChecks, ["athletes-1"]);
  assert.deepEqual(authorizer.founderChecks, []);
  assert.deepEqual(persistence.calls, ["list"]);
});

test("Athletes Calendar mutations authorize Founder inside the lifecycle lock", async () => {
  const authorizer = new FakeAuthorizer();
  const persistence = new FakePersistence();
  const service = new AthletesCalendarService(authorizer, persistence);

  await service.create("founder-1", "athletes-1", WRITE);
  await service.update("founder-1", "athletes-1", "calendar-1", WRITE);
  await service.cancel("founder-1", "athletes-1", "calendar-1");

  assert.deepEqual(authorizer.memberChecks, []);
  assert.deepEqual(authorizer.founderChecks, []);
  assert.deepEqual(persistence.calls, ["lock", "create", "lock", "update", "lock", "cancel"]);
});

test("Athletes Calendar rejects a locked non-Founder before persistence mutation", async () => {
  const persistence = new FakePersistence();
  persistence.lockedRole = "MEMBER";
  const service = new AthletesCalendarService(new FakeAuthorizer(), persistence);

  await assert.rejects(
    () => service.create("member-1", "athletes-1", WRITE),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_REQUIRED",
  );
  assert.deepEqual(persistence.calls, ["lock"]);
});
