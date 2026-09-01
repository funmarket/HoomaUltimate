import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Play integration tests");
const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

async function resetDatabase() {
  await db.eventPlayerInvite.deleteMany();
  await db.eventChatMessage.deleteMany();
  await db.eventChatRoom.deleteMany();
  await db.eventCheckIn.deleteMany();
  await db.formationSlot.deleteMany();
  await db.formation.deleteMany();
  await db.eventRsvp.deleteMany();
  await db.playEventDetails.deleteMany();
  await db.event.deleteMany();
  await db.teamGame.deleteMany();
  await db.teamChallengeMessage.deleteMany();
  await db.teamChallenge.deleteMany();
  await db.teamLineupSlot.deleteMany();
  await db.teamLineup.deleteMany();
  await db.teamCapabilityGrant.deleteMany();
  await db.teamResponsibilityAssignment.deleteMany();
  await db.teamPlayerOffer.deleteMany();
  await db.teamPlayer.deleteMany();
  await db.team.deleteMany();
  await db.communityJoinRequest.deleteMany();
  await db.communityMembership.deleteMany();
  await db.community.deleteMany();
  await db.placeImage.deleteMany();
  await db.placeOwnership.deleteMany();
  await db.place.deleteMany();
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

async function register(base: string, username: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      password: "correct horse battery staple",
      displayUsername: username,
      displayName: username,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const credential = await db.webCredential.findUniqueOrThrow({
    where: { loginUsername: username },
  });
  return { cookie, userId: credential.userId };
}

function memberHeaders(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("Open Matches are account-only and independent from Community privacy", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "open_match_founder");
    const viewer = await register(base, "open_match_viewer");
    const manager = await register(base, "open_match_manager");
    const invitee = await register(base, "private_match_invitee");
    const outsider = await register(base, "private_match_outsider");

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ name: "Private Medina Club" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };
    await db.community.update({
      where: { id: community.id },
      data: { visibility: "PRIVATE" },
    });
    await db.communityMembership.create({
      data: { communityId: community.id, userId: manager.userId, role: "COACH" },
    });

    const publicCommunityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ name: "Public Medina Club" }),
    });
    assert.equal(publicCommunityResponse.status, 201);
    const publicCommunity = (await publicCommunityResponse.json()) as { id: string };
    const approvedPlace = await db.place.create({
      data: {
        slug: `open-match-watch-place-${Date.now().toString(36)}`,
        name: "Open Match Watch Place",
        address: "20 Avenue Habib Bourguiba",
        moderationStatus: "APPROVED",
        suggestedByUserId: founder.userId,
      },
    });

    const startsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const createResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({
        communityId: community.id,
        type: "PLAY",
        title: "Need players tonight",
        startsAt,
        capacity: 10,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        play: {
          pitchType: "FIVE_A_SIDE",
          skillLevel: "MIXED",
          format: "FIVE_V_FIVE",
        },
      }),
    });
    assert.equal(createResponse.status, 201);
    const event = (await createResponse.json()) as {
      id: string;
      playDetails: { visibility: string };
    };
    assert.equal(event.playDetails.visibility, "OPEN");

    const persisted = await db.playEventDetails.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    assert.equal(persisted.visibility, "OPEN");

    const publicCommunityEventResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({
        communityId: publicCommunity.id,
        type: "PLAY",
        title: "Public community pickup",
        startsAt: new Date(Date.now() + 90 * 60_000).toISOString(),
        capacity: 10,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        play: {
          pitchType: "FIVE_A_SIDE",
          skillLevel: "MIXED",
          format: "FIVE_V_FIVE",
          visibility: "OPEN",
        },
      }),
    });
    assert.equal(publicCommunityEventResponse.status, 201);
    const publicCommunityEvent = (await publicCommunityEventResponse.json()) as { id: string };

    const watchEventResponse = await fetch(`${base}/api/v1/events`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({
        communityId: null,
        placeId: approvedPlace.id,
        type: "WATCH",
        title: "Public derby watch",
        startsAt: new Date(Date.now() + 120 * 60_000).toISOString(),
        capacity: 20,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        watch: {
          kind: "MATCH",
          teamOneName: "Club A",
          teamTwoName: "Club B",
        },
      }),
    });
    assert.equal(watchEventResponse.status, 201);
    const watchEvent = (await watchEventResponse.json()) as { id: string };

    const publicWatchDetail = await fetch(`${base}/api/public/v1/events/${watchEvent.id}`);
    assert.equal(publicWatchDetail.status, 200);
    assert.equal(((await publicWatchDetail.json()) as { type: string }).type, "WATCH");

    const publicCommunityOpenMatches = await fetch(`${base}/api/v1/play/open-matches?limit=50`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(publicCommunityOpenMatches.status, 200);
    const publicCommunityOpenPage = (await publicCommunityOpenMatches.json()) as {
      items: { id: string; communityId: string | null; playDetails: { visibility: string } }[];
    };
    assert.ok(publicCommunityOpenPage.items.some((row) => row.id === publicCommunityEvent.id));

    const publicPlay = await fetch(`${base}/api/public/v1/events?type=PLAY&limit=50`);
    assert.equal(publicPlay.status, 200);
    const publicPage = (await publicPlay.json()) as { items: unknown[] };
    assert.equal(publicPage.items.length, 0);

    const anonymousOpenMatches = await fetch(`${base}/api/v1/play/open-matches?limit=50`);
    assert.equal(anonymousOpenMatches.status, 401);

    const anonymousDetail = await fetch(`${base}/api/public/v1/events/${event.id}`);
    assert.equal(anonymousDetail.status, 404);

    const openMatches = await fetch(`${base}/api/v1/play/open-matches?limit=50`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(openMatches.status, 200);
    const openPage = (await openMatches.json()) as {
      items: { id: string; communityId: string | null; playDetails: { visibility: string } }[];
    };
    const visible = openPage.items.find((row) => row.id === event.id);
    assert.ok(visible);
    assert.equal(visible.communityId, community.id);
    assert.equal(visible.playDetails.visibility, "OPEN");

    const firstOpenPageResponse = await fetch(`${base}/api/v1/play/open-matches?limit=1`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(firstOpenPageResponse.status, 200);
    const firstOpenPage = (await firstOpenPageResponse.json()) as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    assert.equal(firstOpenPage.items.length, 1);
    assert.ok(firstOpenPage.nextCursor);
    const secondOpenPageResponse = await fetch(
      `${base}/api/v1/play/open-matches?limit=1&cursor=${firstOpenPage.nextCursor}`,
      { headers: { cookie: viewer.cookie } },
    );
    assert.equal(secondOpenPageResponse.status, 200);
    const secondOpenPage = (await secondOpenPageResponse.json()) as { items: { id: string }[] };
    assert.equal(secondOpenPage.items.length, 1);
    assert.notEqual(secondOpenPage.items[0]?.id, firstOpenPage.items[0]?.id);

    const authenticatedPublicDetail = await fetch(`${base}/api/public/v1/events/${event.id}`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(authenticatedPublicDetail.status, 404);

    const viewerDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(viewerDetail.status, 200);

    const join = await fetch(`${base}/api/v1/events/${event.id}/join`, {
      method: "POST",
      headers: memberHeaders(viewer.cookie),
    });
    assert.equal(join.status, 200);

    const makePrivate = await fetch(`${base}/api/v1/events/${event.id}`, {
      method: "PATCH",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ play: { visibility: "PRIVATE" } }),
    });
    assert.equal(makePrivate.status, 200);
    const privateEvent = (await makePrivate.json()) as {
      playDetails: { visibility: string };
    };
    assert.equal(privateEvent.playDetails.visibility, "PRIVATE");

    const privateOpenMatches = await fetch(`${base}/api/v1/play/open-matches?limit=50`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(privateOpenMatches.status, 200);
    const privatePage = (await privateOpenMatches.json()) as { items: { id: string }[] };
    assert.equal(
      privatePage.items.some((row) => row.id === event.id),
      false,
    );

    const outsiderDetail = await fetch(`${base}/api/public/v1/events/${event.id}`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(outsiderDetail.status, 404);

    const outsiderPlayDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(outsiderPlayDetail.status, 404);

    const outsiderJoin = await fetch(`${base}/api/v1/events/${event.id}/join`, {
      method: "POST",
      headers: memberHeaders(outsider.cookie),
    });
    assert.equal(outsiderJoin.status, 404);

    const participantPublicDetail = await fetch(`${base}/api/public/v1/events/${event.id}`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(participantPublicDetail.status, 404);

    const participantPlayDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(participantPlayDetail.status, 200);

    const cancelRsvp = await fetch(`${base}/api/v1/events/${event.id}/rsvp`, {
      method: "DELETE",
      headers: memberHeaders(viewer.cookie),
    });
    assert.equal(cancelRsvp.status, 200);

    const formerParticipantDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(formerParticipantDetail.status, 404);

    const managerDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: manager.cookie },
    });
    assert.equal(managerDetail.status, 200);

    const inviteeListingResponse = await fetch(`${base}/api/v1/play/player-listing`, {
      method: "PUT",
      headers: memberHeaders(invitee.cookie),
      body: JSON.stringify({ lookingFor: "GAME" }),
    });
    assert.equal(inviteeListingResponse.status, 200);
    const inviteeListing = (await inviteeListingResponse.json()) as { id: string };
    const inviteResponse = await fetch(
      `${base}/api/v1/play/player-listings/${inviteeListing.id}/event-invite`,
      {
        method: "POST",
        headers: memberHeaders(founder.cookie),
        body: JSON.stringify({ eventId: event.id }),
      },
    );
    assert.equal(inviteResponse.status, 201);
    const inviteeDetail = await fetch(`${base}/api/v1/play/matches/${event.id}`, {
      headers: { cookie: invitee.cookie },
    });
    assert.equal(inviteeDetail.status, 200);

    const membersUrl = `${base}/api/v1/communities/${community.id}/members`;
    const communityMembers = await fetch(membersUrl, {
      headers: { cookie: viewer.cookie },
    });
    assert.equal(communityMembers.status, 403);

    const makeOpen = await fetch(`${base}/api/v1/events/${event.id}`, {
      method: "PATCH",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ play: { visibility: "OPEN" } }),
    });
    assert.equal(makeOpen.status, 200);
    const reopenedEvent = (await makeOpen.json()) as { playDetails: { visibility: string } };
    assert.equal(reopenedEvent.playDetails.visibility, "OPEN");

    const reopenedOpenMatches = await fetch(`${base}/api/v1/play/open-matches?limit=50`, {
      headers: { cookie: outsider.cookie },
    });
    assert.equal(reopenedOpenMatches.status, 200);
    const reopenedPage = (await reopenedOpenMatches.json()) as { items: { id: string }[] };
    assert.ok(reopenedPage.items.some((row) => row.id === event.id));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
