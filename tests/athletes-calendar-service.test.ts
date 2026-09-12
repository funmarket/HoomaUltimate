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

class FakeRepository implements AthletesCalendarRepository {
  calls: string[] = [];

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

  async update(
    _communityId: string,
    _entryId: string,
    _input: AthletesCalendarEntryUpdateInput,
  ) {
    this.calls.push("update");
    return ENTRY;
  }

  async cancel() {
    this.calls.push("cancel");
    return { ...ENTRY, status: "CANCELLED" as const };
  }
}

test("Athletes Calendar reads require active member authorization", async () => {
  const authorizer = new FakeAuthorizer();
  const repository = new FakeRepository();
  const service = new AthletesCalendarService(authorizer, repository);

  const result = await service.list("member-1", "athletes-1", {
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-10-01T00:00:00.000Z",
  });

  assert.deepEqual(result, [ENTRY]);
  assert.deepEqual(authorizer.memberChecks, ["athletes-1"]);
  assert.deepEqual(authorizer.founderChecks, []);
  assert.deepEqual(repository.calls, ["list"]);
});

test("Athletes Calendar mutations require Founder authorization", async () => {
  const authorizer = new FakeAuthorizer();
  const repository = new FakeRepository();
  const service = new AthletesCalendarService(authorizer, repository);

  await service.create("founder-1", "athletes-1", WRITE);
  await service.update("founder-1", "athletes-1", "calendar-1", WRITE);
  await service.cancel("founder-1", "athletes-1", "calendar-1");

  assert.deepEqual(authorizer.memberChecks, []);
  assert.deepEqual(authorizer.founderChecks, ["athletes-1", "athletes-1", "athletes-1"]);
  assert.deepEqual(repository.calls, ["create", "update", "cancel"]);
});
