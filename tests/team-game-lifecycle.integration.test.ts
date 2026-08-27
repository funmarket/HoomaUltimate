import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { DiscoveryService } from "../apps/api/src/modules/discovery/application/discovery.service.js";
import { PrismaDiscoveryRepository } from "../apps/api/src/modules/discovery/infrastructure/prisma-discovery.repository.js";
import { PrismaTeamRepository } from "../apps/api/src/modules/teams/infrastructure/prisma-team.repository.js";

const db = getDatabaseClient();

function offset(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

test("confirmed TeamGame keeps canonical timing and optional location through its lifecycle", async () => {
  const suffix = Date.now().toString(36);
  const userOne = await db.user.create({ data: {} });
  const userTwo = await db.user.create({ data: {} });
  const communityOne = await db.community.create({
    data: {
      slug: `team-game-home-${suffix}`,
      name: "Team Game Home",
      createdByUserId: userOne.id,
    },
  });
  const communityTwo = await db.community.create({
    data: {
      slug: `team-game-away-${suffix}`,
      name: "Team Game Away",
      createdByUserId: userTwo.id,
    },
  });
  const homeTeam = await db.team.create({
    data: {
      communityId: communityOne.id,
      slug: `team-game-home-fc-${suffix}`,
      name: "Team Game Home FC",
      createdByUserId: userOne.id,
    },
  });
  const awayTeam = await db.team.create({
    data: {
      communityId: communityTwo.id,
      slug: `team-game-away-fc-${suffix}`,
      name: "Team Game Away FC",
      createdByUserId: userTwo.id,
    },
  });
  const place = await db.place.create({
    data: {
      slug: `team-game-pitch-${suffix}`,
      name: "Team Game Pitch",
      address: "11 Matchday Road",
      city: "Tunis",
      houma: "Centre",
      moderationStatus: "APPROVED",
      suggestedByUserId: userOne.id,
    },
  });
  await db.placeCapabilityApplication.create({
    data: {
      placeId: place.id,
      applicantUserId: userOne.id,
      kind: "PITCH",
      summary: "Approved integration-test football pitch",
      hourlyRateMinor: 45_000,
      currency: "TND",
      contactName: "Pitch Operator",
      status: "APPROVED",
    },
  });

  try {
    const now = new Date();
    const kickoff = offset(now, -20);
    const endsAt = offset(now, 20);
    const teams = new PrismaTeamRepository(db);
    const challenge = await teams.createChallenge(userOne.id, {
      challengerTeamId: homeTeam.id,
      challengedTeamId: awayTeam.id,
      format: "FIVE_V_FIVE",
      proposedAt: kickoff.toISOString(),
      proposedEndsAt: endsAt.toISOString(),
      placeId: place.id,
      venueName: null,
      address: null,
      message: "Canonical timing and Pitch regression",
    });

    await teams.acceptChallenge(challenge.id);

    const game = await db.teamGame.findUniqueOrThrow({ where: { challengeId: challenge.id } });
    assert.equal(game.status, "CONFIRMED");
    assert.equal(game.scheduledAt?.toISOString(), kickoff.toISOString());
    assert.equal(game.endsAt?.toISOString(), endsAt.toISOString());
    assert.equal(game.placeId, place.id);
    assert.equal(game.venueName, null);
    assert.equal(game.address, null);

    const listedGames = (await teams.listGames(userOne.id, 30)) as Array<{
      id: string;
      place: { id: string; name: string } | null;
    }>;
    const listedGame = listedGames.find((candidate) => candidate.id === game.id);
    assert.equal(listedGame?.place?.id, place.id);
    assert.equal(listedGame?.place?.name, "Team Game Pitch");

    const manualChallenge = await teams.createChallenge(userOne.id, {
      challengerTeamId: homeTeam.id,
      challengedTeamId: awayTeam.id,
      format: "FIVE_V_FIVE",
      proposedAt: null,
      proposedEndsAt: null,
      placeId: null,
      venueName: "Neighbourhood training field",
      address: "7 Local Street",
      message: "Manual game location regression",
    });
    await teams.acceptChallenge(manualChallenge.id);
    const manualGame = await db.teamGame.findUniqueOrThrow({
      where: { challengeId: manualChallenge.id },
    });
    assert.equal(manualGame.placeId, null);
    assert.equal(manualGame.venueName, "Neighbourhood training field");
    assert.equal(manualGame.address, "7 Local Street");

    const discovery = new DiscoveryService(new PrismaDiscoveryRepository(db));
    const itemAt = async (at: Date) => {
      const response = await discovery.now(at, 30, communityOne.id);
      return response.items.find(
        (candidate) => candidate.activityType === "TEAM_GAME" && candidate.sourceId === game.id,
      );
    };

    const live = await itemAt(now);
    assert.ok(live, "TeamGame should remain discoverable more than 15 minutes after kickoff");
    assert.equal(live.urgency, "LIVE_NOW");
    assert.equal(live.startsAt, kickoff.toISOString());
    assert.equal(live.endsAt, endsAt.toISOString());

    assert.equal((await itemAt(offset(endsAt, -10)))?.urgency, "ENDING_SOON");
    assert.equal((await itemAt(offset(endsAt, -4)))?.urgency, "FINAL_MINUTES");
    assert.equal(await itemAt(offset(endsAt, 1)), undefined);
  } finally {
    await db.teamGame.deleteMany({
      where: { OR: [{ homeTeamId: homeTeam.id }, { awayTeamId: awayTeam.id }] },
    });
    await db.teamChallenge.deleteMany({
      where: {
        OR: [
          { challengerTeamId: homeTeam.id },
          { challengedTeamId: homeTeam.id },
          { challengerTeamId: awayTeam.id },
          { challengedTeamId: awayTeam.id },
        ],
      },
    });
    await db.placeCapabilityApplication.deleteMany({ where: { placeId: place.id } });
    await db.place.deleteMany({ where: { id: place.id } });
    await db.team.deleteMany({ where: { id: { in: [homeTeam.id, awayTeam.id] } } });
    await db.community.deleteMany({
      where: { id: { in: [communityOne.id, communityTwo.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userOne.id, userTwo.id] } } });
  }
});

test("approved canonical Place WATCH event participates in HOOMA NOW without a Community", async () => {
  const suffix = `${Date.now().toString(36)}-watch`;
  const owner = await db.user.create({ data: {} });
  const place = await db.place.create({
    data: {
      slug: `watch-now-place-${suffix}`,
      name: "Watch Now Place",
      address: "1 Discovery Street",
      city: "Tunis",
      houma: "Centre",
      moderationStatus: "APPROVED",
      suggestedByUserId: owner.id,
    },
  });
  const now = new Date();
  const startsAt = offset(now, 20);
  const event = await db.event.create({
    data: {
      communityId: null,
      placeId: place.id,
      createdByUserId: owner.id,
      type: "WATCH",
      title: "Watch Discovery Event",
      startsAt,
      timezone: "Africa/Tunis",
    },
  });

  try {
    const discovery = new DiscoveryService(new PrismaDiscoveryRepository(db));
    const response = await discovery.now(now, 30);
    const item = response.items.find(
      (candidate) => candidate.activityType === "WATCH_EVENT" && candidate.sourceId === event.id,
    );

    assert.ok(item, "approved Place WATCH event should appear in HOOMA NOW");
    assert.equal(item.sourceDomain, "EVENTS");
    assert.equal(item.href, `/events/${event.id}`);
    assert.equal(item.urgency, "STARTING_SOON");
    assert.equal(item.context.communityId, null);
    assert.equal(item.context.communityName, null);
    assert.equal(item.context.city, "Tunis");
    assert.equal(item.context.houma, "Centre");

    await db.place.update({ where: { id: place.id }, data: { archivedAt: new Date() } });
    const archivedResponse = await discovery.now(now, 30);
    assert.equal(
      archivedResponse.items.some((candidate) => candidate.sourceId === event.id),
      false,
      "archived Place WATCH event should remain excluded from HOOMA NOW",
    );
  } finally {
    await db.event.deleteMany({ where: { id: event.id } });
    await db.place.deleteMany({ where: { id: place.id } });
    await db.user.deleteMany({ where: { id: owner.id } });
  }
});
