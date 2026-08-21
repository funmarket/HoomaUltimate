import assert from "node:assert/strict";
import test from "node:test";
import type { EventCreateInput } from "@hooma/contracts";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type { EventRepository } from "../apps/api/src/modules/events/application/event.repository.js";
import { EventService } from "../apps/api/src/modules/events/application/event.service.js";

function repositoryStub(onCreate: () => void): EventRepository {
  return {
    listPublic: async () => [],
    getPublic: async () => null,
    access: async () => null,
    create: async () => { onCreate(); return { id: "event-1" }; },
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
    postChat: async () => ({})
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
  currency: "TND"
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
    format: "FIVE_V_FIVE"
  }
};

test("EventService rejects WATCH creation while Watch is frozen", async () => {
  let createCalled = false;
  let coachCheckCalled = false;
  const communities = {
    requireCoach: async () => { coachCheckCalled = true; }
  } as unknown as CommunityService;
  const service = new EventService(repositoryStub(() => { createCalled = true; }), communities);

  await assert.rejects(
    () => service.create("user-1", watchInput),
    (error: unknown) => error instanceof AppError && error.statusCode === 409 && error.code === "WATCH_NOT_ENABLED"
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
    }
  } as unknown as CommunityService;
  const service = new EventService(repositoryStub(() => { createCalled = true; }), communities);

  await service.create("user-1", playInput);
  assert.equal(coachCheckCalled, true);
  assert.equal(createCalled, true);
});
