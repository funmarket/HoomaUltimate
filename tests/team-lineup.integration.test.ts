import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Team lineup integration tests");

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

test("Team lineup slots reference active TeamPlayer records from the same Team", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const founder = await register(base, "lineup_founder");
    const assistant = await register(base, "lineup_assistant");
    const outsider = await register(base, "lineup_outsider");

    const communityOneResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ name: "Lineup Community One" })
    });
    assert.equal(communityOneResponse.status, 201);
    const communityOne = await communityOneResponse.json() as { id: string };

    const teamOneResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ communityId: communityOne.id, name: "Lineup Team One" })
    });
    assert.equal(teamOneResponse.status, 201);
    const teamOne = await teamOneResponse.json() as { id: string };

    const assignAssistant = await fetch(`${base}/api/v1/teams/${teamOne.id}/assistants`, {
      method: "POST",
      headers: memberHeaders(founder.cookie),
      body: JSON.stringify({ userId: assistant.userId, capabilities: ["MANAGE_LINEUP"] })
    });
    assert.equal(assignAssistant.status, 201);

    const assistantPlayer = await db.teamPlayer.findUniqueOrThrow({
      where: { teamId_userId: { teamId: teamOne.id, userId: assistant.userId } },
      select: { id: true }
    });

    const communityTwoResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(outsider.cookie),
      body: JSON.stringify({ name: "Lineup Community Two" })
    });
    assert.equal(communityTwoResponse.status, 201);
    const communityTwo = await communityTwoResponse.json() as { id: string };

    const teamTwoResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: memberHeaders(outsider.cookie),
      body: JSON.stringify({ communityId: communityTwo.id, name: "Lineup Team Two" })
    });
    assert.equal(teamTwoResponse.status, 201);
    const teamTwo = await teamTwoResponse.json() as { id: string };
    const outsiderPlayer = await db.teamPlayer.findUniqueOrThrow({
      where: { teamId_userId: { teamId: teamTwo.id, userId: outsider.userId } },
      select: { id: true }
    });

    const invalidLineup = await fetch(`${base}/api/v1/teams/${teamOne.id}/lineups`, {
      method: "POST",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({
        name: "Invalid opponent roster",
        formation: "2-2",
        matchFormat: "FIVE_V_FIVE",
        published: false,
        slots: [{ teamPlayerId: outsiderPlayer.id, position: "GK", sortOrder: 0 }]
      })
    });
    assert.equal(invalidLineup.status, 400);
    const invalidBody = await invalidLineup.json() as { error?: { code?: string } };
    assert.equal(invalidBody.error?.code, "TEAM_LINEUP_INVALID_PLAYER");

    const validLineup = await fetch(`${base}/api/v1/teams/${teamOne.id}/lineups`, {
      method: "POST",
      headers: memberHeaders(assistant.cookie),
      body: JSON.stringify({
        name: "Valid active roster",
        formation: "2-2",
        matchFormat: "FIVE_V_FIVE",
        published: false,
        slots: [{ teamPlayerId: assistantPlayer.id, position: "GK", sortOrder: 0 }]
      })
    });
    assert.equal(validLineup.status, 201);
    const created = await validLineup.json() as { id: string };

    const persistedSlot = await db.teamLineupSlot.findFirstOrThrow({
      where: { lineupId: created.id },
      select: { teamPlayerId: true }
    });
    assert.equal(persistedSlot.teamPlayerId, assistantPlayer.id);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await resetDatabase();
  }
});
