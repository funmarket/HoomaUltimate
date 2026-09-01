import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for athletes integration tests");

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
  return { cookie, userId: credential.userId, username };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("Athletes HTTP lifecycle uses independent persistence and canonical users", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);

  try {
    const founder = await register(base, `ath_founder_${suffix}`);
    const runner = await register(base, `ath_runner_${suffix}`);
    const moderator = await register(base, `ath_mod_${suffix}`);

    const createdResponse = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `Carthage Runners ${suffix}`,
        sport: "RUNNING",
        city: "Tunis",
        houma: "Carthage",
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as { id: string; joinPolicy: string };
    assert.equal(created.joinPolicy, "APPROVAL_REQUIRED");

    const invalidPrivateOpen = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `Invalid Private Open ${suffix}`,
        sport: "RUNNING",
        visibility: "PRIVATE",
        joinPolicy: "OPEN",
      }),
    });
    assert.equal(invalidPrivateOpen.status, 400);
    assert.equal(
      await db.athletesMembership.count({
        where: {
          athletesCommunityId: created.id,
          userId: founder.userId,
          role: "FOUNDER",
          leftAt: null,
        },
      }),
      1,
    );
    assert.equal(await db.community.count({ where: { name: `Carthage Runners ${suffix}` } }), 0);

    const publicList = await fetch(`${base}/api/public/v1/athletes?sport=RUNNING&limit=10`);
    assert.equal(publicList.status, 200);
    const publicItems = (await publicList.json()) as { items: { id: string }[] };
    assert.equal(
      publicItems.items.some((item) => item.id === created.id),
      true,
    );

    const publicDetail = await fetch(`${base}/api/public/v1/athletes/${created.id}`);
    assert.equal(publicDetail.status, 200);
    const publicDetailBody = (await publicDetail.json()) as Record<string, unknown>;
    assert.equal("createdByUserId" in publicDetailBody, false);
    assert.equal("viewerRole" in publicDetailBody, false);

    const requestJoin = await fetch(`${base}/api/v1/athletes/${created.id}/join`, {
      method: "POST",
      headers: headers(runner.cookie),
    });
    assert.equal(requestJoin.status, 202);
    assert.equal(((await requestJoin.json()) as { status: string }).status, "PENDING");
    assert.equal(
      await db.athletesJoinRequest.count({
        where: { athletesCommunityId: created.id, userId: runner.userId, status: "PENDING" },
      }),
      1,
    );

    const duplicateJoin = await fetch(`${base}/api/v1/athletes/${created.id}/join`, {
      method: "POST",
      headers: headers(runner.cookie),
    });
    assert.equal(duplicateJoin.status, 202);
    assert.equal(
      await db.athletesJoinRequest.count({
        where: { athletesCommunityId: created.id, userId: runner.userId, status: "PENDING" },
      }),
      1,
    );

    const outsiderRequests = await fetch(`${base}/api/v1/athletes/${created.id}/join-requests`, {
      headers: headers(runner.cookie),
    });
    assert.equal(outsiderRequests.status, 403);

    const approve = await fetch(
      `${base}/api/v1/athletes/${created.id}/join-requests/${runner.userId}/approve`,
      { method: "POST", headers: headers(founder.cookie) },
    );
    assert.equal(approve.status, 200);
    assert.equal(
      await db.athletesMembership.count({
        where: { athletesCommunityId: created.id, userId: runner.userId, leftAt: null },
      }),
      1,
    );

    const addModerator = await fetch(`${base}/api/v1/athletes/${created.id}/members`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ username: moderator.username }),
    });
    assert.equal(addModerator.status, 201);
    const promote = await fetch(
      `${base}/api/v1/athletes/${created.id}/members/${moderator.userId}/role`,
      {
        method: "PATCH",
        headers: headers(founder.cookie),
        body: JSON.stringify({ role: "MODERATOR" }),
      },
    );
    assert.equal(promote.status, 200);

    const declineMissing = await fetch(
      `${base}/api/v1/athletes/${created.id}/join-requests/${founder.userId}/decline`,
      { method: "POST", headers: headers(moderator.cookie) },
    );
    assert.equal(declineMissing.status, 404);

    const founderDetail = await fetch(`${base}/api/v1/athletes/${created.id}`, {
      headers: headers(founder.cookie),
    });
    assert.equal(founderDetail.status, 200);
    assert.equal(((await founderDetail.json()) as { viewerRole: string }).viewerRole, "FOUNDER");

    const removeModerator = await fetch(
      `${base}/api/v1/athletes/${created.id}/members/${moderator.userId}`,
      { method: "DELETE", headers: headers(founder.cookie) },
    );
    assert.equal(removeModerator.status, 200);
    assert.equal(
      await db.athletesMembership.count({
        where: { athletesCommunityId: created.id, userId: moderator.userId, leftAt: null },
      }),
      0,
    );

    const rejoinModerator = await fetch(`${base}/api/v1/athletes/${created.id}/join`, {
      method: "POST",
      headers: headers(moderator.cookie),
    });
    assert.equal(rejoinModerator.status, 202);
    assert.equal(
      await db.athletesJoinRequest.count({
        where: { athletesCommunityId: created.id, userId: moderator.userId, status: "PENDING" },
      }),
      1,
    );

    const directAddPending = await fetch(`${base}/api/v1/athletes/${created.id}/members`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ username: moderator.username }),
    });
    assert.equal(directAddPending.status, 201);
    assert.equal(
      await db.athletesJoinRequest.count({
        where: { athletesCommunityId: created.id, userId: moderator.userId, status: "PENDING" },
      }),
      0,
    );
    assert.equal(
      await db.athletesMembership.count({
        where: { athletesCommunityId: created.id, userId: moderator.userId, leftAt: null },
      }),
      1,
    );

    const duplicateDirectAdds = await Promise.all([
      fetch(`${base}/api/v1/athletes/${created.id}/members`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({ username: moderator.username }),
      }),
      fetch(`${base}/api/v1/athletes/${created.id}/members`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({ username: moderator.username }),
      }),
    ]);
    assert.equal(
      duplicateDirectAdds.every((response) => response.status === 201),
      true,
    );
    assert.equal(
      await db.athletesMembership.count({
        where: { athletesCommunityId: created.id, userId: moderator.userId, leftAt: null },
      }),
      1,
    );

    const openCreated = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `Open Cyclists ${suffix}`,
        sport: "CYCLING",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
      }),
    });
    assert.equal(openCreated.status, 201);
    const open = (await openCreated.json()) as { id: string };
    const concurrentJoins = await Promise.all([
      fetch(`${base}/api/v1/athletes/${open.id}/join`, {
        method: "POST",
        headers: headers(runner.cookie),
      }),
      fetch(`${base}/api/v1/athletes/${open.id}/join`, {
        method: "POST",
        headers: headers(runner.cookie),
      }),
    ]);
    assert.equal(
      concurrentJoins.every((response) => response.status === 201),
      true,
    );
    assert.equal(
      await db.athletesMembership.count({
        where: { athletesCommunityId: open.id, userId: runner.userId, leftAt: null },
      }),
      1,
    );

    const members = await fetch(`${base}/api/v1/athletes/${created.id}/members`, {
      headers: headers(runner.cookie),
    });
    assert.equal(members.status, 200);
    assert.equal(
      ((await members.json()) as { userId: string }[]).some(
        (member) => member.userId === founder.userId,
      ),
      true,
    );
  } finally {
    server.close();
  }
});
