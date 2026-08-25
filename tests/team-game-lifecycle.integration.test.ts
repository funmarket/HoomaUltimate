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

test("confirmed TeamGame keeps canonical timing through the full HOOMA NOW lifecycle", async () => {
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
      message: "Canonical timing regression",
    });

    await teams.acceptChallenge(challenge.id);

    const game = await db.teamGame.findUniqueOrThrow({ where: { challengeId: challenge.id } });
    assert.equal(game.status, "CONFIRMED");
    assert.equal(game.scheduledAt?.toISOString(), kickoff.toISOString());
    assert.equal(game.endsAt?.toISOString(), endsAt.toISOString());

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
    await db.team.deleteMany({ where: { id: { in: [homeTeam.id, awayTeam.id] } } });
    await db.community.deleteMany({
      where: { id: { in: [communityOne.id, communityTwo.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userOne.id, userTwo.id] } } });
  }
});
