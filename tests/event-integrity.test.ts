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
  return (await serviceFor(accessRecord, rsvp).getMyRsvp(userId, "event-1")).actions;
}

test("Event check-in policy opens exactly at T-60 and has no closing cutoff", () => {
  const startsAt = new Date("2026-12-01T18:00:00.000Z");
  const opensAt = eventCheckInOpensAt(startsAt);

  assert.equal(EVENT_CHECK_IN_OPEN_BEFORE_MS, 60 * 60 * 1000);
  assert.equal(opensAt.toISOString(), "2026-12-01T17:00:00.000Z");
  assert.equal(new Date("2026-12-01T16:59:00.000Z") < opensAt, true, "T-61 is too early");
  assert.equal(new Date("2026-12-01T17:00:00.000Z") >= opensAt, true, "T-60 is open");
  assert.equal(new Date("2026-12-01T17:30:00.000Z") >= opensAt, true, "T-30 stays open");
  assert.equal(new Date("2026-12-01T18:00:00.000Z") >= opensAt, true, "start time stays open");
  assert.equal(new Date("2026-12-01T19:00:00.000Z") >= opensAt, true, "after start stays open");
});

test("Event participation state uses exact creator identity instead of management authority", async () => {
  const managerActions = await participationActions(
    "coach-who-did-not-create",
    playAccess({ createdByUserId: "actual-creator" }),
    null,
  );
  assert.deepEqual(
    {
      isCreator: managerActions.isCreator,
      canJoin: managerActions.canJoin,
      canCancelRsvp: managerActions.canCancelRsvp,
      canCheckIn: managerActions.canCheckIn,
      attended: managerActions.attended,
      checkInUnavailableReason: managerActions.checkInUnavailableReason,
    },
    {
      isCreator: false,
      canJoin: true,
      canCancelRsvp: false,
      canCheckIn: false,
      attended: false,
      checkInUnavailableReason: "NO_RSVP",
    },
  );

  const creatorActions = await participationActions(
    "actual-creator",
    playAccess({ createdByUserId: "actual-creator" }),
    null,
  );
  assert.deepEqual(
    {
      isCreator: creatorActions.isCreator,
      canJoin: creatorActions.canJoin,
      canCancelRsvp: creatorActions.canCancelRsvp,
      canCheckIn: creatorActions.canCheckIn,
      attended: creatorActions.attended,
      checkInUnavailableReason: creatorActions.checkInUnavailableReason,
    },
    {
      isCreator: true,
      canJoin: false,
      canCancelRsvp: false,
      canCheckIn: false,
      attended: false,
      checkInUnavailableReason: "CREATOR",
    },
  );
});

test("Event participation actions cover confirmed, waitlisted, cancelled, attended and inactive states", async () => {
  const tooEarly = await participationActions("player", playAccess(), { status: "CONFIRMED" });
  assert.equal(tooEarly.canCancelRsvp, true);
  assert.equal(tooEarly.canCheckIn, false);
  assert.equal(tooEarly.checkInUnavailableReason, "TOO_EARLY");

  const open = await participationActions(
    "player",
    playAccess({ startsAt: new Date(Date.now() + 30 * 60_000) }),
    { status: "CONFIRMED" },
  );
  assert.equal(open.canCheckIn, true);
  assert.equal(open.canCancelRsvp, true);
  assert.equal(open.checkInUnavailableReason, null);

  const waitlisted = await participationActions("player", playAccess(), { status: "WAITLISTED" });
  assert.equal(waitlisted.canCheckIn, false);
  assert.equal(waitlisted.canCancelRsvp, true);
  assert.equal(waitlisted.checkInUnavailableReason, "WAITLISTED");

  const cancelled = await participationActions("player", playAccess(), { status: "CANCELLED" });
  assert.equal(cancelled.canJoin, true);
  assert.equal(cancelled.canCancelRsvp, false);
  assert.equal(cancelled.canCheckIn, false);
  assert.equal(cancelled.checkInUnavailableReason, "CANCELLED");

  const attended = await participationActions(
    "player",
    playAccess({ startsAt: new Date(Date.now() + 30 * 60_000) }),
    { status: "ATTENDED" },
  );
  assert.equal(attended.attended, true);
  assert.equal(attended.canCancelRsvp, false);
  assert.equal(attended.canCheckIn, false);
  assert.equal(attended.checkInUnavailableReason, "ALREADY_ATTENDED");

  const inactive = await participationActions(
    "player",
    playAccess({ status: "CANCELLED", startsAt: new Date(Date.now() + 30 * 60_000) }),
    { status: "CONFIRMED" },
  );
  assert.equal(inactive.canJoin, false);
  assert.equal(inactive.canCancelRsvp, false);
  assert.equal(inactive.canCheckIn, false);
  assert.equal(inactive.checkInUnavailableReason, "EVENT_INACTIVE");
});

test("Event Detail, Check-In and Place Detail consume canonical participation actions", async () => {
  const [eventDetail, checkInPage, placeDetail] = await Promise.all([
    readFile("packages/frontend/src/events/EventDetailPage.tsx", "utf8"),
    readFile("packages/frontend/src/events/CheckInPage.tsx", "utf8"),
    readFile("packages/frontend/src/places/PlaceDetailPage.tsx", "utf8"),
  ]);

  assert.match(eventDetail, /eventApi\.myRsvp\(eventId\)/);
  assert.match(eventDetail, /setActions\(result\.actions\)/);
  assert.match(eventDetail, /actions\?\.canCheckIn/);
  assert.match(eventDetail, /actions\?\.checkInUnavailableReason === "TOO_EARLY"/);
  assert.match(eventDetail, /actions\.checkInOpensAt/);

  assert.match(checkInPage, /eventApi\s*\.myRsvp\(eventId\)/);
  assert.match(checkInPage, /setActions\(result\.actions\)/);
  assert.match(checkInPage, /if \(!actions\?\.canCheckIn\) return/);
  assert.match(checkInPage, /Location is optional/);
  assert.match(checkInPage, /runCheckIn\(undefined, undefined, "Checked in without location\."\)/);

  assert.match(placeDetail, /eventsApi\.myRsvp\(eventId\)/);
  assert.match(placeDetail, /setParticipationActions\(result\.actions\)/);
  assert.match(placeDetail, /participationActions\?\.canJoin/);
  assert.match(placeDetail, /participationActions\?\.canCancelRsvp/);
  assert.match(placeDetail, /rsvp === "ATTENDED"/);
});

test("repository enforces opening time server-side and does not add a post-start cutoff", async () => {
  const source = await readFile(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
    "utf8",
  );
  const checkInSource = source.slice(source.indexOf("async checkIn("), source.indexOf("async listChat("));

  assert.match(checkInSource, /checkedInAt < eventCheckInOpensAt\(event\.startsAt\)/);
  assert.doesNotMatch(checkInSource, /checkedInAt > event\.startsAt/);
  assert.doesNotMatch(checkInSource, /endsAt/);
  assert.doesNotMatch(checkInSource, /type !== "PLAY"/);
});
