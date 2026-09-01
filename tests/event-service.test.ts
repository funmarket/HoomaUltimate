import assert from "node:assert/strict";
import test from "node:test";
import type { EventCreateInput } from "@hooma/contracts";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type {
  EventAccessRecord,
  EventRepository,
} from "../apps/api/src/modules/events/application/event.repository.js";
import { EventService } from "../apps/api/src/modules/events/application/event.service.js";
import { EventError } from "../apps/api/src/modules/events/domain/event-error.js";
import type { ApprovedPitchReader } from "../apps/api/src/modules/pitch/application/approved-pitch.reader.js";
import type { PlaceService } from "../apps/api/src/modules/places/application/place.service.js";

function repositoryStub(onCreate: () => void): EventRepository {
  return {
    listPublic: async () => ({ items: [], nextCursor: null }),
    listOpenPlay: async () => ({ items: [], nextCursor: null }),
    getPublic: async () => null,
    access: async () => null,
    canAccessPlay: async () => false,
    getRsvp: async () => null,
    formationRoster: async () => [],
    create: async () => {
      onCreate();
      return { id: "event-1" } as never;
    },
    update: async () => ({}) as never,
    cancel: async () => ({}),
    complete: async () => null,
    join: async () => ({ status: "CONFIRMED" }),
    cancelRsvp: async () => ({ cancelled: true, promotedUserId: null }),
    listManagedPlayEvents: async () => [],
    upsertPlayerInvite: async () => ({}),
    listIncomingPlayerInvites: async () => [],
    listPendingPlayerInvitesForManager: async () => [],
    getPlayerInviteForTarget: async () => null,
    acceptPlayerInvite: async () => null,
    declinePlayerInvite: async () => null,
    createFormation: async () => ({}),
    canViewMemberContent: async () => false,
    listFormations: async () => [],
    checkIn: async () => ({}),
    listChat: async () => [],
    postChat: async () => ({}),
  };
}

const watchInput: EventCreateInput = {
  communityId: null,
  placeId: "place-1",
  type: "WATCH",
  title: "Esperance vs Club Africain",
  startsAt: "2026-08-22T18:00:00.000Z",
  timezone: "Africa/Tunis",
  waitlistEnabled: true,
  entryFeeMinor: 0,
  currency: "TND",
  play: null,
  watch: {
    kind: "MATCH",
    teamOneName: "Esperance",
    teamOneLogoUrl: "https://images.example.com/esperance",
    teamTwoName: "Club Africain",
    teamTwoLogoUrl: "https://images.example.com/club-africain?size=512",
  },
};
const playInput: EventCreateInput = {
  communityId: "community-1",
  placeId: null,
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
    visibility: "OPEN",
  },
  watch: null,
};

function approvedPlaces(onGet?: (placeId: string) => void): PlaceService {
  return {
    getPublic: async (placeId: string) => {
      onGet?.(placeId);
      return { id: placeId };
    },
  } as unknown as PlaceService;
}

function approvedPitch(onGet?: (placeId: string) => void): ApprovedPitchReader {
  return {
    getApproved: async (placeId: string) => {
      onGet?.(placeId);
      return { id: "pitch-1", place: { id: placeId } };
    },
  } as unknown as ApprovedPitchReader;
}

function playAccess(overrides: Partial<EventAccessRecord> = {}): EventAccessRecord {
  return {
    communityId: "community-1",
    placeId: null,
    type: "PLAY",
    playVisibility: "OPEN",
    watchKind: null,
    createdByUserId: "founder",
    status: "PUBLISHED",
    entryFeeMinor: 0n,
    ...overrides,
  };
}

test("EventService creates WATCH events through an approved canonical Place", async () => {
  let createCalled = false;
  let coachCheckCalled = false;
  let placeCheckCalled = false;
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
    approvedPlaces((placeId) => {
      assert.equal(placeId, "place-1");
      placeCheckCalled = true;
    }),
  );
  await service.create("user-1", watchInput);
  assert.equal(placeCheckCalled, true);
  assert.equal(coachCheckCalled, false);
  assert.equal(createCalled, true);
});

test("EventService still creates free PLAY events through community coach authority", async () => {
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
    approvedPlaces(),
  );
  await service.create("user-1", playInput);
  assert.equal(coachCheckCalled, true);
  assert.equal(createCalled, true);
});

test("EventService validates an optional PLAY placeId as an approved Pitch", async () => {
  let pitchCheckCalled = false;
  let createCalled = false;
  const communities = {
    requireCoach: async () => undefined,
  } as unknown as CommunityService;
  const service = new EventService(
    repositoryStub(() => {
      createCalled = true;
    }),
    communities,
    approvedPlaces(),
    approvedPitch((placeId) => {
      assert.equal(placeId, "pitch-place-1");
      pitchCheckCalled = true;
    }),
  );

  await service.create("user-1", { ...playInput, placeId: "pitch-place-1" });
  assert.equal(pitchCheckCalled, true);
  assert.equal(createCalled, true);
});

test("EventService checks persisted Cultural subtype on partial updates", async () => {
  const repository = repositoryStub(() => {});
  let updateCalled = false;
  repository.access = async () => ({
    communityId: null,
    placeId: "place-1",
    type: "WATCH",
    playVisibility: null,
    watchKind: "CULTURAL",
    createdByUserId: "user-1",
    status: "PUBLISHED",
    entryFeeMinor: 0n,
  });
  repository.update = async () => {
    updateCalled = true;
    return {} as never;
  };
  const places = {
    isVerifiedOwner: async (placeId: string, userId: string) => {
      assert.equal(placeId, "place-1");
      assert.equal(userId, "user-1");
      return false;
    },
  } as unknown as PlaceService;
  const service = new EventService(repository, {} as CommunityService, places);

  await assert.rejects(
    () => service.update("user-1", "event-1", { title: "Updated Cultural title" }),
    (error: unknown) =>
      error instanceof EventError && error.code === "WATCH_CULTURAL_OWNER_REQUIRED",
  );
  assert.equal(updateCalled, false);
});

test("EventService returns only the authenticated user's RSVP state", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => playAccess();
  repository.canAccessPlay = async () => true;
  repository.getRsvp = async (eventId, userId) => {
    assert.equal(eventId, "event-1");
    assert.equal(userId, "user-1");
    return { status: "WAITLISTED" };
  };
  const service = new EventService(repository, {} as CommunityService, approvedPlaces());
  assert.deepEqual(await service.getMyRsvp("user-1", "event-1"), {
    rsvp: { status: "WAITLISTED" },
  });
});

test("EventService hides a private PLAY event from an unauthorized viewer and joiner", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => playAccess({ playVisibility: "PRIVATE" });
  repository.canAccessPlay = async () => false;
  repository.getPublic = async () => ({ id: "event-1" }) as never;
  const service = new EventService(repository, {} as CommunityService, approvedPlaces());

  await assert.rejects(
    () => service.getVisible("event-1", "outsider"),
    (error: unknown) => error instanceof EventError && error.code === "EVENT_NOT_FOUND",
  );
  await assert.rejects(
    () => service.join("outsider", "event-1"),
    (error: unknown) => error instanceof EventError && error.code === "EVENT_NOT_FOUND",
  );
});

test("EventService allows authorized users to open an OPEN PLAY event", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => playAccess();
  repository.canAccessPlay = async () => true;
  repository.getPublic = async () => ({ id: "event-1", type: "PLAY" }) as never;
  const service = new EventService(repository, {} as CommunityService, approvedPlaces());

  const event = await service.getVisible("event-1", "viewer");
  assert.equal(event.id, "event-1");
});

test("EventService rejects formation players outside the confirmed event roster", async () => {
  const repository = repositoryStub(() => {});
  repository.access = async () => playAccess({ createdByUserId: "user-1" });
  repository.formationRoster = async () => [
    { userId: "player-1", status: "CONFIRMED", presentation: null },
  ];
  const service = new EventService(repository, {} as CommunityService, approvedPlaces());
  await assert.rejects(
    () =>
      service.createFormation("user-1", "event-1", {
        name: "5v5",
        format: "FIVE_V_FIVE",
        published: true,
        slots: [{ userId: "outsider", team: "A", position: "GK", label: "GK", x: 50, y: 90 }],
      }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("confirmed or attended RSVP"),
  );
});
