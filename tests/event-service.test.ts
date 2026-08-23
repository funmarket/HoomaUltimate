import assert from "node:assert/strict";
import test from "node:test";
import type { EventCreateInput } from "@hooma/contracts";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type { EventRepository } from "../apps/api/src/modules/events/application/event.repository.js";
import { EventService } from "../apps/api/src/modules/events/application/event.service.js";
import { EventError } from "../apps/api/src/modules/events/domain/event-error.js";

function repositoryStub(onCreate: () => void): EventRepository {
  return {
    listPublic: async () => [],
    getPublic: async () => null,
    access: async () => null,
    getRsvp: async () => null,
    formationRoster: async () => [],
    create: async () => {
      onCreate();
      return { id: "event-1" };
    },
    update: async () => ({}),
    cancel: async () => ({}),
    complete: async () => ({}),
    join: async () => ({ status: "CONFIRMED" }),
    cancelRsvp: async () => ({ cancelled: true, promotedUserId: null }),
    createFormation: async () => ({}),
    canViewMemberContent: async () => false,
    listFormations: async () => [],
    checkIn: async () => ({}),
    listChat: async () => [],
    postChat: async () => ({}),
  };
}

const watchInput: EventCreateInput = {
  communityId: "community-1",
  type: "WATCH",
  title: "Derby night",
  startsAt: "2026-08-22T18:00:00.000Z",
  timezone: "Africa/Tunis",
  waitlistEnabled: true,
  entryFeeMinor: 0,
  currency: "TND",
};
const playInput: EventCreateInput = {
  communityId: "community-1",
  type: "PLAY",
  title: "Friday football",
  startsAt: "2026-08-22T18:00:00.000Z",
  timezone: "Africa/Tunis",
  waitlistEnabled: true,
  entryFeeMinor: 0,
  currency: "TND",
  play: {
    pitchType: "FIVE_A_SIDE",
    skillLevel: "MIXED",
    format: "FIVE_V_FIVE",
  },
};

test("EventService rejects WATCH creation until the Watch vertical slice owns creation", async () => {
  let createCalled = false;
  let coachCheckCalled = false;
  const communities = {
    requireCoach: async () => {
      coachCheckCalled = true;
    },
  } as unknown as CommunityService;
  const service = new EventService(
    repositoryStub(() => {
      createCalled = true;
    }),
    communities,
  );
  await assert.rejects(
    () => service.create("user-1", watchInput),
    (error: unknown) => error instanceof EventError && error.code === "WATCH_NOT_ENABLED",
  );
  assert.equal(createCalled, false);
  assert.equal(coachCheckCalled, false);
});

test("EventService still creates free PLAY events through the canonical repository", async () => {
  let createCalled = false;
  let coachCheckCalled = false;
  const communities = {
    requireCoach: async (communityId: string, userId: string) => {
      assert.equal(communityId, "community-1");
      assert.equal(userId, "user-1");
      coachCheckCalled = true;
    },
  } as unknown as CommunityService;
  const service = new EventService(
    repositoryStub(() => {
      createCalled = true;
    }),
    communities,
  );
  await service.create("user-1", playInput);
  assert.equal(coachCheckCalled, true);
  assert.equal(createCalled, true);
});

test("EventService returns only the authenticated user's RSVP state", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => ({
    communityId: "community-1",
    createdByUserId: "founder",
    status: "PUBLISHED",
    entryFeeMinor: 0n,
  });
  repository.getRsvp = async (eventId, userId) => {
    assert.equal(eventId, "event-1");
    assert.equal(userId, "user-1");
    return { status: "WAITLISTED" };
  };
  const service = new EventService(repository, {} as CommunityService);
  assert.deepEqual(await service.getMyRsvp("user-1", "event-1"), {
    rsvp: { status: "WAITLISTED" },
  });
});

test("EventService rejects formation players outside the confirmed event roster", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => ({
    communityId: "community-1",
    createdByUserId: "user-1",
    status: "PUBLISHED",
    entryFeeMinor: 0n,
  });
  repository.formationRoster = async () => [
    { userId: "player-1", status: "CONFIRMED", presentation: null },
  ];
  const service = new EventService(repository, {} as CommunityService);
  await assert.rejects(
    () =>
      service.createFormation("user-1", "event-1", {
        name: "5v5",
        format: "FIVE_V_FIVE",
        published: true,
        slots: [
          {
            userId: "outsider",
            team: "A",
            position: "GK",
            label: "GK",
            x: 50,
            y: 90,
          },
        ],
      }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("confirmed or attended RSVP"),
  );
});
