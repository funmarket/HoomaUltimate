import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type {
  EventAccessRecord,
  EventRepository,
} from "../apps/api/src/modules/events/application/event.repository.js";
import { EventService } from "../apps/api/src/modules/events/application/event.service.js";
import {
  EVENT_CHECK_IN_OPEN_BEFORE_MS,
  eventCheckInOpensAt,
} from "../apps/api/src/modules/events/domain/event-policy.js";
import type { PlaceService } from "../apps/api/src/modules/places/application/place.service.js";

function playAccess(overrides: Partial<EventAccessRecord> = {}): EventAccessRecord {
  return {
    communityId: "community-1",
    placeId: null,
    type: "PLAY",
    playVisibility: "OPEN",
    playFormat: "FIVE_V_FIVE",
    watchKind: null,
    createdByUserId: "creator",
    status: "PUBLISHED",
    startsAt: new Date(Date.now() + 2 * 60 * 60_000),
    entryFeeMinor: 0n,
    ...overrides,
  };
}

function repositoryStub(
  accessRecord: EventAccessRecord,
  rsvp: { status: string } | null,
): EventRepository {
  return {
    access: async () => accessRecord,
    canAccessPlay: async () => true,
    getRsvp: async () => rsvp as never,
  } as unknown as EventRepository;
}

function serviceFor(
  accessRecord: EventAccessRecord,
  rsvp: { status: string } | null,
): EventService {
  return new EventService(
    repositoryStub(accessRecord, rsvp),
    {} as CommunityService,
    {} as PlaceService,
  );
}

async function participationActions(
  userId: string,
  accessRecord: EventAccessRecord,
  rsvp: { status: string } | null,
) {
  const service = serviceFor(accessRecord, rsvp);
  const result = await service.getMyRsvp(userId, "event-1");
  return result.actions;
}

test("Event check-in policy opens exactly at T-60 and has no closing cutoff", () => {
  const startsAt = new Date("2026-12-01T18:00:00.000Z");
  const opensAt = eventCheckInOpensAt(startsAt);
  const t61 = new Date("2026-12-01T16:59:00.000Z");
  const t60 = new Date("2026-12-01T17:00:00.000Z");
  const t30 = new Date("2026-12-01T17:30:00.000Z");
  const start = new Date("2026-12-01T18:00:00.000Z");
  const afterStart = new Date("2026-12-01T19:00:00.000Z");

  assert.equal(EVENT_CHECK_IN_OPEN_BEFORE_MS, 60 * 60 * 1000);
  assert.equal(opensAt.toISOString(), "2026-12-01T17:00:00.000Z");
  assert.equal(t61 < opensAt, true);
  assert.equal(t60 >= opensAt, true);
  assert.equal(t30 >= opensAt, true);
  assert.equal(start >= opensAt, true);
  assert.equal(afterStart >= opensAt, true);
});

test("Event participation state uses exact creator identity", async () => {
  const access = playAccess({ createdByUserId: "actual-creator" });
  const manager = await participationActions("coach-who-did-not-create", access, null);
  const creator = await participationActions("actual-creator", access, null);

  assert.equal(manager.isCreator, false);
  assert.equal(manager.canJoin, true);
  assert.equal(manager.canCancelRsvp, false);
  assert.equal(manager.canCheckIn, false);
  assert.equal(manager.attended, false);
  assert.equal(manager.checkInUnavailableReason, "NO_RSVP");

  assert.equal(creator.isCreator, true);
  assert.equal(creator.canJoin, false);
  assert.equal(creator.canCancelRsvp, false);
  assert.equal(creator.canCheckIn, false);
  assert.equal(creator.attended, false);
  assert.equal(creator.checkInUnavailableReason, "CREATOR");
});

test("Event participation actions cover RSVP and lifecycle states", async () => {
  const confirmed = { status: "CONFIRMED" };
  const tooEarly = await participationActions("player", playAccess(), confirmed);
  assert.equal(tooEarly.canCancelRsvp, true);
  assert.equal(tooEarly.canCheckIn, false);
  assert.equal(tooEarly.checkInUnavailableReason, "TOO_EARLY");

  const openAccess = playAccess({ startsAt: new Date(Date.now() + 30 * 60_000) });
  const open = await participationActions("player", openAccess, confirmed);
  assert.equal(open.canCheckIn, true);
  assert.equal(open.canCancelRsvp, true);
  assert.equal(open.checkInUnavailableReason, null);

  const waitlisted = await participationActions("player", playAccess(), {
    status: "WAITLISTED",
  });
  assert.equal(waitlisted.canCheckIn, false);
  assert.equal(waitlisted.canCancelRsvp, true);
  assert.equal(waitlisted.checkInUnavailableReason, "WAITLISTED");

  const cancelled = await participationActions("player", playAccess(), {
    status: "CANCELLED",
  });
  assert.equal(cancelled.canJoin, true);
  assert.equal(cancelled.canCancelRsvp, false);
  assert.equal(cancelled.canCheckIn, false);
  assert.equal(cancelled.checkInUnavailableReason, "CANCELLED");

  const attended = await participationActions("player", openAccess, {
    status: "ATTENDED",
  });
  assert.equal(attended.attended, true);
  assert.equal(attended.canCancelRsvp, false);
  assert.equal(attended.canCheckIn, false);
  assert.equal(attended.checkInUnavailableReason, "ALREADY_ATTENDED");

  const inactiveAccess = playAccess({
    status: "CANCELLED",
    startsAt: new Date(Date.now() + 30 * 60_000),
  });
  const inactive = await participationActions("player", inactiveAccess, confirmed);
  assert.equal(inactive.canJoin, false);
  assert.equal(inactive.canCancelRsvp, false);
  assert.equal(inactive.canCheckIn, false);
  assert.equal(inactive.checkInUnavailableReason, "EVENT_INACTIVE");
});

test("Event frontend consumers use canonical participation actions", async () => {
  const eventDetailPath = "packages/frontend/src/events/EventDetailPage.tsx";
  const checkInPath = "packages/frontend/src/events/CheckInPage.tsx";
  const placeDetailPath = "packages/frontend/src/places/PlaceDetailPage.tsx";
  const [eventDetail, checkInPage, placeDetail] = await Promise.all([
    readFile(eventDetailPath, "utf8"),
    readFile(checkInPath, "utf8"),
    readFile(placeDetailPath, "utf8"),
  ]);

  assert.match(eventDetail, /eventApi\.myRsvp\(eventId\)/);
  assert.match(eventDetail, /setActions\(result\.actions\)/);
  assert.match(eventDetail, /actions\?\.canCheckIn/);
  assert.match(eventDetail, /checkInUnavailableReason === "TOO_EARLY"/);
  assert.match(eventDetail, /actions\.checkInOpensAt/);

  assert.match(checkInPage, /eventApi\s*\.myRsvp\(eventId\)/);
  assert.match(checkInPage, /setActions\(result\.actions\)/);
  assert.match(checkInPage, /if \(!actions\?\.canCheckIn\) return/);
  assert.match(checkInPage, /Location is optional/);
  assert.match(checkInPage, /runCheckIn\(undefined, undefined/);

  assert.match(placeDetail, /eventsApi\.myRsvp\(eventId\)/);
  assert.match(placeDetail, /setParticipationActions\(result\.actions\)/);
  assert.match(placeDetail, /participationActions\?\.canJoin/);
  assert.match(placeDetail, /participationActions\?\.canCancelRsvp/);
  assert.match(placeDetail, /rsvp === "ATTENDED"/);
});

test("repository enforces T-60 without a post-start cutoff", async () => {
  const path = "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts";
  const source = await readFile(path, "utf8");
  const start = source.indexOf("async checkIn(");
  const end = source.indexOf("async listChat(");
  const checkInSource = source.slice(start, end);

  assert.match(checkInSource, /checkedInAt < eventCheckInOpensAt\(event\.startsAt\)/);
  assert.doesNotMatch(checkInSource, /checkedInAt > event\.startsAt/);
  assert.doesNotMatch(checkInSource, /endsAt/);
  assert.doesNotMatch(checkInSource, /type !== "PLAY"/);
});
