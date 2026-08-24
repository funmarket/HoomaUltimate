import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Team media integration tests");

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

async function register(base: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: "team_media_owner",
      password: "correct horse battery staple",
      displayUsername: "team_media_owner",
      displayName: "Team Media Owner",
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie);
  return cookie;
}

function memberHeaders(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("Team logo and banner URLs persist through creation, editing, and public read-back", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await register(base);
    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: memberHeaders(cookie),
      body: JSON.stringify({ name: "Team Media Houma" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const createResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: memberHeaders(cookie),
      body: JSON.stringify({
        communityId: community.id,
        name: "Media FC",
        badgeUrl: "https://images.example.com/media-fc-logo.png",
        bannerUrl: "https://images.example.com/media-fc-banner.jpg",
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as {
      id: string;
      badgeUrl: string | null;
      bannerUrl: string | null;
    };
    assert.equal(created.badgeUrl, "https://images.example.com/media-fc-logo.png");
    assert.equal(created.bannerUrl, "https://images.example.com/media-fc-banner.jpg");

    const publicCreatedResponse = await fetch(`${base}/api/public/v1/teams/${created.id}`);
    assert.equal(publicCreatedResponse.status, 200);
    const publicCreated = (await publicCreatedResponse.json()) as {
      badgeUrl: string | null;
      bannerUrl: string | null;
    };
    assert.equal(publicCreated.badgeUrl, "https://images.example.com/media-fc-logo.png");
    assert.equal(publicCreated.bannerUrl, "https://images.example.com/media-fc-banner.jpg");

    const updateResponse = await fetch(`${base}/api/v1/teams/${created.id}`, {
      method: "PATCH",
      headers: memberHeaders(cookie),
      body: JSON.stringify({
        badgeUrl: "https://images.example.com/media-fc-logo-v2.png",
        bannerUrl: "https://images.example.com/media-fc-banner-v2.jpg",
      }),
    });
    assert.equal(updateResponse.status, 200);

    const publicUpdatedResponse = await fetch(`${base}/api/public/v1/teams/${created.id}`);
    assert.equal(publicUpdatedResponse.status, 200);
    const publicUpdated = (await publicUpdatedResponse.json()) as {
      badgeUrl: string | null;
      bannerUrl: string | null;
    };
    assert.equal(publicUpdated.badgeUrl, "https://images.example.com/media-fc-logo-v2.png");
    assert.equal(publicUpdated.bannerUrl, "https://images.example.com/media-fc-banner-v2.jpg");
  } finally {
    server.close();
    await new Promise<void>((resolve) => server.once("close", resolve));
  }
});
