import assert from "node:assert/strict";
import test from "node:test";
import type { TeamLineupInput } from "@hooma/contracts";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Teams integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token"
});
const db = getDatabaseClient();

async function resetDatabase() {
  await db.teamGame.deleteMany();
  await db.teamChallengeMessage.deleteMany();
  await db.teamChallenge.deleteMany();
  await db.teamLineupSlot.deleteMany();
  await db.teamLineup.deleteMany();
  await db.teamCapabilityGrant.deleteMany();
  await db.teamResponsibilityAssignment.deleteMany();
  await db.teamPlayer.deleteMany();
  await db.team.deleteMany();
  await db.communityMembership.deleteMany();
  await db.community.deleteMany();
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
      displayName: username
    })
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  const credential = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: username } });
  return { cookie, userId: credential.userId };
}

function memberHeaders(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function fiveAsideLineup(
  playerIds: readonly (string | null)[],
  published: boolean,
  name = "Matchday Five"
): TeamLineupInput {
  const positions: TeamLineupInput["slots"][number]["position"][] = ["GK", "CB", "CB", "CM", "ST"];
  const coordinates = [
    [50, 90],
    [30, 65],
    [70, 65],
    [50, 42],
    [50, 18]
  ] as const;

  return {
    name,
    formation: "1-2-1",
    matchFormat: "FIVE_V_FIVE",
    published,
    slots: positions.map((position, index) => ({
      teamPlayerId: playerIds[index] ?? null,
      position,
      x: coordinates[index]?.[0] ?? 50,
      y: coordinates[index]?.[1] ?? 50,
      isStarter: true,
      sortOrder: index
    }))
  };
}

test("Team lifecycle includes resumable lineup drafts, publish privacy, and scoped authority", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "founder_team");
    const communityCoach = await register(base, "community_coach");
    const assistant = await register(base, "assistant_team");
    const playerThree = await register(base, "lineup_three");
    const playerFour = await register(base, "lineup_four");
    const playerFive = await register(base, "lineup_five");

    const communityOneResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ name: "Bab Souika" })
    });
    assert.equal(communityOneResponse.status, 201);
    const communityOne = (await communityOneResponse.json()) as { id: string };

    const appointCommunityCoach = await fetch(`${base}/api/v1/communities/${communityOne.id}/coaches`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ userId: communityCoach.userId })
    });
    assert.equal(appointCommunityCoach.status, 201);

    const teamOneResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ communityId: communityOne.id, name: "Bab Souika FC" })
    });
    assert.equal(teamOneResponse.status, 201);
    const teamOne = (await teamOneResponse.json()) as { id: string };

    const fallbackEdit = await fetch(`${base}/api/v1/teams/${teamOne.id}`, {
      method: "PATCH",
      headers: memberHeaders(communityCoach.cookie),
      body: JSON.stringify({ motto: "Houma first" })
    });
    assert.equal(fallbackEdit.status, 200);

    const communityTwoResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(communityCoach.cookie),
      body: JSON.stringify({ name: "Medina" })
    });
    assert.equal(communityTwoResponse.status, 201);
    const communityTwo = (await communityTwoResponse.json()) as { id: string };

    const teamTwoResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: memberHeaders(communityCoach.cookie),
      body: JSON.stringify({ communityId: communityTwo.id, name: "Medina FC" })
    });
    assert.equal(teamTwoResponse.status, 201);
    const teamTwo = (await teamTwoResponse.json()) as { id: string };

    const publicTeams = await fetch(`${base}/api/public/v1/teams?limit=1`);
    assert.equal(publicTeams.status, 200);
    const page = (await publicTeams.json()) as { items: unknown[]; nextCursor: string | null };
    assert.equal(page.items.length, 1);
    assert.ok(page.nextCursor);

    const assignAssistant = await fetch(`${base}/api/v1/teams/${teamTwo.id}/assistants`, {
      method: "POST",
      headers: memberHeaders(communityCoach.cookie),
      body: JSON.stringify({
        userId: assistant.userId,
        capabilities: ["RESPOND_TO_CHALLENGE", "MANAGE_LINEUP"]
      })
    });
    assert.equal(assignAssistant.status, 201);

    const deniedAssistantEdit = await fetch(`${base}/api/v1/teams/${teamTwo.id}`, {
      method: "PATCH",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({ motto: "should fail" })
    });
    assert.equal(deniedAssistantEdit.status, 403);

    for (const player of [playerThree, playerFour, playerFive]) {
      const addPlayer = await fetch(`${base}/api/v1/teams/${teamTwo.id}/players`, {
        method: "POST",
        headers: memberHeaders(communityCoach.cookie),
        body: JSON.stringify({ userId: player.userId })
      });
      assert.equal(addPlayer.status, 201);
    }

    const teamTwoRoster = await db.teamPlayer.findMany({
      where: { teamId: teamTwo.id, leftAt: null, active: true },
      select: { id: true, userId: true }
    });
    assert.equal(teamTwoRoster.length, 5);
    const playerIdByUser = new Map(teamTwoRoster.map((player) => [player.userId, player.id]));
    const starterIds = [
      playerIdByUser.get(communityCoach.userId),
      playerIdByUser.get(assistant.userId),
      playerIdByUser.get(playerThree.userId),
      playerIdByUser.get(playerFour.userId),
      playerIdByUser.get(playerFive.userId)
    ];
    assert.ok(starterIds.every((id): id is string => Boolean(id)));

    const incompleteDraft = fiveAsideLineup([...starterIds.slice(0, 4), null], false);
    const saveDraft = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(incompleteDraft)
    });
    assert.equal(saveDraft.status, 200);
    const firstDraft = (await saveDraft.json()) as { id: string; published: boolean };
    assert.equal(firstDraft.published, false);

    const currentDraftResponse = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      headers: memberHeaders(assistant.cookie)
    });
    assert.equal(currentDraftResponse.status, 200);
    const currentDraft = (await currentDraftResponse.json()) as { id: string; published: boolean };
    assert.equal(currentDraft.id, firstDraft.id);
    assert.equal(currentDraft.published, false);

    const ordinaryPlayerPrivateRead = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      headers: memberHeaders(playerThree.cookie)
    });
    assert.equal(ordinaryPlayerPrivateRead.status, 403);

    const publicBeforePublish = await fetch(`${base}/api/public/v1/teams/${teamTwo.id}`);
    assert.equal(publicBeforePublish.status, 200);
    const publicDraftView = (await publicBeforePublish.json()) as { lineups: Array<{ id: string }> };
    assert.equal(publicDraftView.lineups.length, 0);

    const incompletePublish = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({ ...incompleteDraft, published: true })
    });
    assert.equal(incompletePublish.status, 400);

    const publishResponse = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup(starterIds, true))
    });
    assert.equal(publishResponse.status, 200);
    const firstPublished = (await publishResponse.json()) as { id: string; published: boolean };
    assert.equal(firstPublished.id, firstDraft.id);
    assert.equal(firstPublished.published, true);

    const publicAfterPublish = await fetch(`${base}/api/public/v1/teams/${teamTwo.id}`);
    assert.equal(publicAfterPublish.status, 200);
    const publicPublishedView = (await publicAfterPublish.json()) as { lineups: Array<{ id: string }> };
    assert.equal(publicPublishedView.lineups[0]?.id, firstDraft.id);

    const secondDraftResponse = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup([...starterIds.slice(0, 4), null], false, "Next Match"))
    });
    assert.equal(secondDraftResponse.status, 200);
    const secondDraft = (await secondDraftResponse.json()) as { id: string; published: boolean };
    assert.notEqual(secondDraft.id, firstPublished.id);
    assert.equal(secondDraft.published, false);

    const publicWhileEditing = await fetch(`${base}/api/public/v1/teams/${teamTwo.id}`);
    assert.equal(publicWhileEditing.status, 200);
    const publicWhileEditingView = (await publicWhileEditing.json()) as { lineups: Array<{ id: string }> };
    assert.equal(publicWhileEditingView.lineups[0]?.id, firstPublished.id);

    const resaveDraftResponse = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup([...starterIds.slice(0, 4), null], false, "Next Match Revised"))
    });
    assert.equal(resaveDraftResponse.status, 200);
    const resavedDraft = (await resaveDraftResponse.json()) as { id: string; name: string };
    assert.equal(resavedDraft.id, secondDraft.id);
    assert.equal(resavedDraft.name, "Next Match Revised");

    const publishSecondResponse = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup(starterIds, true, "Next Match Revised"))
    });
    assert.equal(publishSecondResponse.status, 200);
    const secondPublished = (await publishSecondResponse.json()) as { id: string };
    assert.equal(secondPublished.id, secondDraft.id);

    const currentRows = await db.teamLineup.count({ where: { teamId: teamTwo.id, active: true, isCurrent: true } });
    assert.equal(currentRows, 1);

    const publicAfterSecondPublish = await fetch(`${base}/api/public/v1/teams/${teamTwo.id}`);
    const latestPublic = (await publicAfterSecondPublish.json()) as { lineups: Array<{ id: string }> };
    assert.equal(latestPublic.lineups[0]?.id, secondPublished.id);

    const duplicateIds = [...starterIds];
    duplicateIds[1] = duplicateIds[0];
    const duplicateAssignment = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup(duplicateIds, true))
    });
    assert.equal(duplicateAssignment.status, 400);

    const teamOnePlayer = await db.teamPlayer.findUniqueOrThrow({
      where: { teamId_userId: { teamId: teamOne.id, userId: founder.userId } },
      select: { id: true }
    });
    const foreignIds = [...starterIds];
    foreignIds[0] = teamOnePlayer.id;
    const foreignAssignment = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify(fiveAsideLineup(foreignIds, true))
    });
    assert.equal(foreignAssignment.status, 400);

    const formatMismatch = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups/current`, {
      method: "PUT",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({ ...fiveAsideLineup(starterIds, false), formation: "4-3-3" })
    });
    assert.equal(formatMismatch.status, 400);

    const selfChallenge = await fetch(`${base}/api/v1/teams/challenges`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({
        challengerTeamId: teamOne.id,
        challengedTeamId: teamOne.id,
        format: "FIVE_V_FIVE"
      })
    });
    assert.equal(selfChallenge.status, 400);

    const challengeResponse = await fetch(`${base}/api/v1/teams/challenges`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({
        challengerTeamId: teamOne.id,
        challengedTeamId: teamTwo.id,
        format: "FIVE_V_FIVE",
        message: "Friday?"
      })
    });
    assert.equal(challengeResponse.status, 201);
    const challenge = (await challengeResponse.json()) as { id: string };

    const prematureMessage = await fetch(`${base}/api/v1/teams/challenges/${challenge.id}/messages`, {
      method: "POST",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({ body: "Too early." })
    });
    assert.equal(prematureMessage.status, 409);

    const acceptResponse = await fetch(`${base}/api/v1/teams/challenges/${challenge.id}/accept`, {
      method: "POST",
      headers: memberHeaders(assistant.cookie)
    });
    assert.equal(acceptResponse.status, 200);

    const messageResponse = await fetch(`${base}/api/v1/teams/challenges/${challenge.id}/messages`, {
      method: "POST",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({ body: "We are in." })
    });
    assert.equal(messageResponse.status, 201);

    const games = await fetch(`${base}/api/v1/teams/games`, { headers: { cookie: assistant.cookie } });
    assert.equal(games.status, 200);
    const gameRows = (await games.json()) as unknown[];
    assert.equal(gameRows.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await resetDatabase();
  }
});
