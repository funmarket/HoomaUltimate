import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Teams integration tests");
const config = loadApiConfig({ ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, WEB_ORIGIN: "http://localhost:5173", TELEGRAM_ORIGIN: "http://localhost:5174", TELEGRAM_BOT_TOKEN: "integration-test-token" });
const db = getDatabaseClient();
async function resetDatabase() {
  await db.teamGame.deleteMany(); await db.teamChallengeMessage.deleteMany(); await db.teamChallenge.deleteMany(); await db.teamLineupSlot.deleteMany(); await db.teamLineup.deleteMany(); await db.teamCapabilityGrant.deleteMany(); await db.teamResponsibilityAssignment.deleteMany(); await db.teamPlayer.deleteMany(); await db.team.deleteMany(); await db.communityMembership.deleteMany(); await db.community.deleteMany(); await db.webSession.deleteMany(); await db.webCredential.deleteMany(); await db.telegramIdentity.deleteMany(); await db.platformRoleAssignment.deleteMany(); await db.auditLog.deleteMany(); await db.userPresentation.deleteMany(); await db.user.deleteMany();
}
async function register(base: string, username: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, { method: "POST", headers: { "content-type": "application/json", origin: config.WEB_ORIGIN }, body: JSON.stringify({ loginUsername: username, password: "correct horse battery staple", displayUsername: username, displayName: username }) });
  assert.equal(response.status, 201); const cookie = response.headers.get("set-cookie"); assert.ok(cookie); const credential = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: username } }); return { cookie: cookie!, userId: credential.userId };
}
function memberHeaders(cookie: string) { return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" }; }
test("mature Team lifecycle is rehoused with Community Coach fallback and Assistant capabilities", async () => {
  await resetDatabase(); const app = createApp(config, createContainer(config)); const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve)); const address = server.address(); assert.ok(address && typeof address === "object"); const base = `http://127.0.0.1:${address.port}`;
  try {
    const founder = await register(base, "founder_team"); const communityCoach = await register(base, "community_coach"); const assistant = await register(base, "assistant_team");
    const communityResponse = await fetch(`${base}/api/v1/communities`, { method: "POST", headers: memberHeaders(founder.cookie), body: JSON.stringify({ name: "Bab Souika" }) }); assert.equal(communityResponse.status, 201); const community = await communityResponse.json() as { id: string };
    const appointCommunityCoach = await fetch(`${base}/api/v1/communities/${community.id}/coaches`, { method: "POST", headers: memberHeaders(founder.cookie), body: JSON.stringify({ userId: communityCoach.userId }) }); assert.equal(appointCommunityCoach.status, 201);
    const teamOneResponse = await fetch(`${base}/api/v1/teams`, { method: "POST", headers: memberHeaders(founder.cookie), body: JSON.stringify({ communityId: community.id, name: "Bab Souika FC" }) }); assert.equal(teamOneResponse.status, 201); const teamOne = await teamOneResponse.json() as { id: string };
    const teamTwoResponse = await fetch(`${base}/api/v1/teams`, { method: "POST", headers: memberHeaders(communityCoach.cookie), body: JSON.stringify({ communityId: community.id, name: "Medina FC" }) }); assert.equal(teamTwoResponse.status, 201); const teamTwo = await teamTwoResponse.json() as { id: string };
    const publicTeams = await fetch(`${base}/api/public/v1/teams?limit=1`); assert.equal(publicTeams.status, 200); const page = await publicTeams.json() as { items: unknown[]; nextCursor: string | null }; assert.equal(page.items.length, 1); assert.ok(page.nextCursor);
    const fallbackEdit = await fetch(`${base}/api/v1/teams/${teamOne.id}`, { method: "PATCH", headers: memberHeaders(communityCoach.cookie), body: JSON.stringify({ motto: "Houma first" }) }); assert.equal(fallbackEdit.status, 200);
    const assignAssistant = await fetch(`${base}/api/v1/teams/${teamTwo.id}/assistants`, { method: "POST", headers: memberHeaders(communityCoach.cookie), body: JSON.stringify({ userId: assistant.userId, capabilities: ["RESPOND_TO_CHALLENGE", "MANAGE_LINEUP"] }) }); assert.equal(assignAssistant.status, 201);
    const deniedAssistantEdit = await fetch(`${base}/api/v1/teams/${teamTwo.id}`, { method: "PATCH", headers: memberHeaders(assistant.cookie), body: JSON.stringify({ motto: "should fail" }) }); assert.equal(deniedAssistantEdit.status, 403);
    const lineup = await fetch(`${base}/api/v1/teams/${teamTwo.id}/lineups`, { method: "POST", headers: memberHeaders(assistant.cookie), body: JSON.stringify({ name: "Matchday", formation: "2-2", slots: [{ userId: assistant.userId, position: "GK", sortOrder: 0 }] }) }); assert.equal(lineup.status, 201);
    const selfChallenge = await fetch(`${base}/api/v1/teams/challenges`, { method: "POST", headers: memberHeaders(founder.cookie), body: JSON.stringify({ challengerTeamId: teamOne.id, challengedTeamId: teamOne.id, format: "FIVE_V_FIVE" }) }); assert.equal(selfChallenge.status, 400);
    const challengeResponse = await fetch(`${base}/api/v1/teams/challenges`, { method: "POST", headers: memberHeaders(founder.cookie), body: JSON.stringify({ challengerTeamId: teamOne.id, challengedTeamId: teamTwo.id, format: "FIVE_V_FIVE", message: "Friday?" }) }); assert.equal(challengeResponse.status, 201); const challenge = await challengeResponse.json() as { id: string };
    const messageResponse = await fetch(`${base}/api/v1/teams/challenges/${challenge.id}/messages`, { method: "POST", headers: memberHeaders(assistant.cookie), body: JSON.stringify({ body: "We are in." }) }); assert.equal(messageResponse.status, 201);
    const acceptResponse = await fetch(`${base}/api/v1/teams/challenges/${challenge.id}/accept`, { method: "POST", headers: memberHeaders(assistant.cookie) }); assert.equal(acceptResponse.status, 200);
    const games = await fetch(`${base}/api/v1/teams/games`, { headers: { cookie: assistant.cookie } }); assert.equal(games.status, 200); const gameRows = await games.json() as unknown[]; assert.equal(gameRows.length, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await resetDatabase(); }
});
