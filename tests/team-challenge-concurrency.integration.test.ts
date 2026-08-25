import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaTeamRepository } from "../apps/api/src/modules/teams/infrastructure/prisma-team.repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Team challenge concurrency tests");
}

const db = getDatabaseClient();
const repository = new PrismaTeamRepository(db);

async function createFixture(label: string) {
  const user = await db.user.create({ data: {} });
  const challengerCommunity = await db.community.create({
    data: {
      slug: `challenge-race-home-${label}-${user.id}`,
      name: `Challenge Race Home ${label}`,
      createdByUserId: user.id,
    },
  });
  const challengedCommunity = await db.community.create({
    data: {
      slug: `challenge-race-away-${label}-${user.id}`,
      name: `Challenge Race Away ${label}`,
      createdByUserId: user.id,
    },
  });
  const challenger = await db.team.create({
    data: {
      communityId: challengerCommunity.id,
      slug: `challenger-${label}-${user.id}`,
      name: `Challenger ${label}`,
      createdByUserId: user.id,
    },
  });
  const challenged = await db.team.create({
    data: {
      communityId: challengedCommunity.id,
      slug: `challenged-${label}-${user.id}`,
      name: `Challenged ${label}`,
      createdByUserId: user.id,
    },
  });
  const challenge = await db.teamChallenge.create({
    data: {
      challengerTeamId: challenger.id,
      challengedTeamId: challenged.id,
      createdByUserId: user.id,
      format: "FIVE_V_FIVE",
    },
  });
  return { user, challengerCommunity, challengedCommunity, challenger, challenged, challenge };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await db.teamGame.deleteMany({ where: { challengeId: fixture.challenge.id } });
  await db.teamChallenge.deleteMany({ where: { id: fixture.challenge.id } });
  await db.team.deleteMany({
    where: { id: { in: [fixture.challenger.id, fixture.challenged.id] } },
  });
  await db.community.deleteMany({
    where: { id: { in: [fixture.challengerCommunity.id, fixture.challengedCommunity.id] } },
  });
  await db.user.deleteMany({ where: { id: fixture.user.id } });
}

test("concurrent Team challenge accept and decline cannot produce a declined challenge with a game", async () => {
  const fixture = await createFixture("accept-decline");
  try {
    await Promise.allSettled([
      repository.acceptChallenge(fixture.challenge.id),
      repository.declineChallenge(fixture.challenge.id),
    ]);

    const challenge = await db.teamChallenge.findUniqueOrThrow({
      where: { id: fixture.challenge.id },
      select: { status: true },
    });
    const gameCount = await db.teamGame.count({
      where: { challengeId: fixture.challenge.id },
    });

    assert.ok(challenge.status === "ACCEPTED" || challenge.status === "DECLINED");
    assert.equal(gameCount, challenge.status === "ACCEPTED" ? 1 : 0);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("concurrent Team challenge accepts are idempotent and create exactly one TeamGame", async () => {
  const fixture = await createFixture("double-accept");
  try {
    const [first, second] = await Promise.all([
      repository.acceptChallenge(fixture.challenge.id),
      repository.acceptChallenge(fixture.challenge.id),
    ]);

    assert.equal(first?.status, "ACCEPTED");
    assert.equal(second?.status, "ACCEPTED");

    const challenge = await db.teamChallenge.findUniqueOrThrow({
      where: { id: fixture.challenge.id },
      select: { status: true },
    });
    const games = await db.teamGame.findMany({
      where: { challengeId: fixture.challenge.id },
    });

    assert.equal(challenge.status, "ACCEPTED");
    assert.equal(games.length, 1);
  } finally {
    await cleanupFixture(fixture);
  }
});

test("concurrent Team challenge accept and cancel leave one coherent terminal state", async () => {
  const fixture = await createFixture("accept-cancel");
  try {
    await Promise.allSettled([
      repository.acceptChallenge(fixture.challenge.id),
      repository.cancelChallenge(fixture.challenge.id),
    ]);

    const challenge = await db.teamChallenge.findUniqueOrThrow({
      where: { id: fixture.challenge.id },
      select: { status: true },
    });
    const gameCount = await db.teamGame.count({
      where: { challengeId: fixture.challenge.id },
    });

    assert.ok(challenge.status === "ACCEPTED" || challenge.status === "CANCELLED");
    assert.equal(gameCount, challenge.status === "ACCEPTED" ? 1 : 0);
  } finally {
    await cleanupFixture(fixture);
  }
});
