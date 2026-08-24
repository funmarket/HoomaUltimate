import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for entity lifecycle integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

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

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("creators and PLATFORM_ADMIN can edit/archive HOOMAs and Teams without destructive row deletion", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);

  try {
    const owner = await register(base, `lifecycle_owner_${suffix}`);
    const outsider = await register(base, `lifecycle_outsider_${suffix}`);
    const admin = await register(base, `lifecycle_admin_${suffix}`);
    await db.platformRoleAssignment.create({
      data: { userId: admin.userId, role: "PLATFORM_ADMIN" },
    });

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(owner.cookie),
      body: JSON.stringify({ name: `Lifecycle HOOMA ${suffix}`, city: "Tunis" }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };

    const outsiderCommunityEdit = await fetch(`${base}/api/v1/communities/${community.id}`, {
      method: "PATCH",
      headers: headers(outsider.cookie),
      body: JSON.stringify({ city: "Blocked" }),
    });
    assert.equal(outsiderCommunityEdit.status, 403);

    const ownerCommunityEdit = await fetch(`${base}/api/v1/communities/${community.id}`, {
      method: "PATCH",
      headers: headers(owner.cookie),
      body: JSON.stringify({ city: "La Marsa" }),
    });
    assert.equal(ownerCommunityEdit.status, 200);

    const adminCommunityEdit = await fetch(`${base}/api/v1/communities/${community.id}`, {
      method: "PATCH",
      headers: headers(admin.cookie),
      body: JSON.stringify({ houma: "Admin reviewed" }),
    });
    assert.equal(adminCommunityEdit.status, 200);

    const teamResponse = await fetch(`${base}/api/v1/teams`, {
      method: "POST",
      headers: headers(owner.cookie),
      body: JSON.stringify({ communityId: community.id, name: `Lifecycle FC ${suffix}` }),
    });
    assert.equal(teamResponse.status, 201);
    const team = (await teamResponse.json()) as { id: string };

    const blockedCommunityArchive = await fetch(`${base}/api/v1/communities/${community.id}`, {
      method: "DELETE",
      headers: headers(owner.cookie),
    });
    assert.equal(blockedCommunityArchive.status, 409);

    const adminTeamEdit = await fetch(`${base}/api/v1/teams/${team.id}`, {
      method: "PATCH",
      headers: headers(admin.cookie),
      body: JSON.stringify({ motto: "Reviewed by App Admin" }),
    });
    assert.equal(adminTeamEdit.status, 200);

    const outsiderTeamArchive = await fetch(`${base}/api/v1/teams/${team.id}`, {
      method: "DELETE",
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderTeamArchive.status, 403);

    const ownerTeamArchive = await fetch(`${base}/api/v1/teams/${team.id}`, {
      method: "DELETE",
      headers: headers(owner.cookie),
    });
    assert.equal(ownerTeamArchive.status, 200);

    assert.equal((await fetch(`${base}/api/public/v1/teams/${team.id}`)).status, 404);
    const archivedTeam = await db.team.findUniqueOrThrow({
      where: { id: team.id },
      select: { status: true },
    });
    assert.equal(archivedTeam.status, "ARCHIVED");
    assert.equal(
      await db.teamPlayer.count({ where: { teamId: team.id, active: true, leftAt: null } }),
      0,
    );
    assert.equal(
      await db.teamResponsibilityAssignment.count({ where: { teamId: team.id, revokedAt: null } }),
      0,
    );

    const ownerCommunityArchive = await fetch(`${base}/api/v1/communities/${community.id}`, {
      method: "DELETE",
      headers: headers(owner.cookie),
    });
    assert.equal(ownerCommunityArchive.status, 200);
    assert.equal((await fetch(`${base}/api/public/v1/communities/${community.id}`)).status, 404);
    const archivedCommunity = await db.community.findUniqueOrThrow({
      where: { id: community.id },
      select: { status: true },
    });
    assert.equal(archivedCommunity.status, "ARCHIVED");
    assert.equal(
      await db.communityMembership.count({ where: { communityId: community.id, leftAt: null } }),
      0,
    );

    const adminCommunityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(owner.cookie),
      body: JSON.stringify({ name: `Admin Delete HOOMA ${suffix}` }),
    });
    assert.equal(adminCommunityResponse.status, 201);
    const adminCommunity = (await adminCommunityResponse.json()) as { id: string };
    const adminArchive = await fetch(`${base}/api/v1/communities/${adminCommunity.id}`, {
      method: "DELETE",
      headers: headers(admin.cookie),
    });
    assert.equal(adminArchive.status, 200);
    assert.equal(
      (await fetch(`${base}/api/public/v1/communities/${adminCommunity.id}`)).status,
      404,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
