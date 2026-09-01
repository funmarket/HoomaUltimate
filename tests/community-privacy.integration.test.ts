import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for community privacy integration tests");

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

async function createCommunity(
  base: string,
  cookie: string,
  input: { name: string; visibility?: "PUBLIC" | "PRIVATE" },
) {
  const response = await fetch(`${base}/api/v1/communities`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as {
    id: string;
    visibility: "PUBLIC" | "PRIVATE";
    joinPolicy: "OPEN" | "APPROVAL_REQUIRED";
  };
}

async function createPlayEvent(base: string, cookie: string, communityId: string, suffix: string) {
  const startsAt = new Date(Date.now() + 60 * 60_000);
  const response = await fetch(`${base}/api/v1/events`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      communityId,
      type: "PLAY",
      title: `Private Match ${suffix}`,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString(),
      timezone: "Africa/Tunis",
      waitlistEnabled: true,
      entryFeeMinor: 0,
      currency: "TND",
      play: {
        pitchType: "FIVE_A_SIDE",
        skillLevel: "MIXED",
        format: "FIVE_V_FIVE",
      },
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

test("PRIVATE HOOMA uses pending requests while PUBLIC HOOMA remains open", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);
  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];

  try {
    const founder = await register(base, `privacy_founder_${suffix}`);
    const requester = await register(base, `privacy_requester_${suffix}`);
    const declined = await register(base, `privacy_declined_${suffix}`);
    const direct = await register(base, `privacy_direct_${suffix}`);
    createdUserIds.push(founder.userId, requester.userId, declined.userId, direct.userId);

    const publicCommunity = await createCommunity(base, founder.cookie, {
      name: `Public HOOMA ${suffix}`,
    });
    createdCommunityIds.push(publicCommunity.id);
    assert.equal(publicCommunity.visibility, "PUBLIC");
    assert.equal(publicCommunity.joinPolicy, "OPEN");

    const publicJoin = await fetch(`${base}/api/v1/communities/${publicCommunity.id}/join`, {
      method: "POST",
      headers: headers(requester.cookie),
    });
    assert.equal(publicJoin.status, 201);
    assert.equal(((await publicJoin.json()) as { status: string }).status, "JOINED");
    assert.equal(
      await db.communityMembership.count({
        where: { communityId: publicCommunity.id, userId: requester.userId, leftAt: null },
      }),
      1,
    );

    const privateCommunity = await createCommunity(base, founder.cookie, {
      name: `Private HOOMA ${suffix}`,
      visibility: "PRIVATE",
    });
    createdCommunityIds.push(privateCommunity.id);
    assert.equal(privateCommunity.visibility, "PRIVATE");
    assert.equal(privateCommunity.joinPolicy, "APPROVAL_REQUIRED");

    const privateEvent = await createPlayEvent(base, founder.cookie, privateCommunity.id, suffix);
    const anonymousEvents = await fetch(`${base}/api/public/v1/events?type=PLAY&limit=50`);
    assert.equal(anonymousEvents.status, 200);
    assert.equal(
      ((await anonymousEvents.json()) as { items: { id: string }[] }).items.some(
        (event) => event.id === privateEvent.id,
      ),
      false,
    );
    assert.equal((await fetch(`${base}/api/public/v1/events/${privateEvent.id}`)).status, 404);

    const publicShell = await fetch(`${base}/api/public/v1/communities/${privateCommunity.id}`);
    assert.equal(publicShell.status, 200);
    assert.equal(((await publicShell.json()) as { visibility: string }).visibility, "PRIVATE");

    const requestJoin = await fetch(`${base}/api/v1/communities/${privateCommunity.id}/join`, {
      method: "POST",
      headers: headers(requester.cookie),
    });
    assert.equal(requestJoin.status, 202);
    assert.equal(((await requestJoin.json()) as { status: string }).status, "PENDING");
    assert.equal(
      await db.communityMembership.count({
        where: { communityId: privateCommunity.id, userId: requester.userId, leftAt: null },
      }),
      0,
    );
    assert.equal(
      await db.communityJoinRequest.count({
        where: { communityId: privateCommunity.id, userId: requester.userId, status: "PENDING" },
      }),
      1,
    );
    assert.equal(
      (
        await fetch(`${base}/api/public/v1/events/${privateEvent.id}`, {
          headers: headers(requester.cookie),
        })
      ).status,
      404,
    );

    const pendingMembers = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/members`,
      { headers: headers(requester.cookie) },
    );
    assert.equal(pendingMembers.status, 403);

    const outsiderRequests = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/join-requests`,
      { headers: headers(requester.cookie) },
    );
    assert.equal(outsiderRequests.status, 403);

    const founderRequests = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/join-requests`,
      { headers: headers(founder.cookie) },
    );
    assert.equal(founderRequests.status, 200);
    const requestRows = (await founderRequests.json()) as {
      requests: { userId: string; status: string }[];
    };
    assert.deepEqual(
      requestRows.requests.map((item) => [item.userId, item.status]),
      [[requester.userId, "PENDING"]],
    );

    const approve = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/join-requests/${requester.userId}/approve`,
      { method: "POST", headers: headers(founder.cookie) },
    );
    assert.equal(approve.status, 200);
    assert.equal(
      await db.communityMembership.count({
        where: { communityId: privateCommunity.id, userId: requester.userId, leftAt: null },
      }),
      1,
    );
    assert.equal(
      await db.communityJoinRequest.count({
        where: { communityId: privateCommunity.id, userId: requester.userId, status: "APPROVED" },
      }),
      1,
    );

    const memberEvents = await fetch(`${base}/api/v1/play/open-matches?limit=50`, {
      headers: headers(requester.cookie),
    });
    assert.equal(memberEvents.status, 200);
    assert.equal(
      ((await memberEvents.json()) as { items: { id: string }[] }).items.some(
        (event) => event.id === privateEvent.id,
      ),
      true,
    );
    assert.equal(
      (
        await fetch(`${base}/api/public/v1/events/${privateEvent.id}`, {
          headers: headers(requester.cookie),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await fetch(`${base}/api/v1/play/matches/${privateEvent.id}`, {
          headers: headers(requester.cookie),
        })
      ).status,
      200,
    );

    const requesterMe = await fetch(`${base}/api/v1/me`, { headers: headers(requester.cookie) });
    assert.equal(requesterMe.status, 200);
    assert.ok(
      ((await requesterMe.json()) as { communities: { id: string }[] }).communities.some(
        (community) => community.id === privateCommunity.id,
      ),
    );

    const declinedJoin = await fetch(`${base}/api/v1/communities/${privateCommunity.id}/join`, {
      method: "POST",
      headers: headers(declined.cookie),
    });
    assert.equal(declinedJoin.status, 202);
    const decline = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/join-requests/${declined.userId}/decline`,
      { method: "POST", headers: headers(founder.cookie) },
    );
    assert.equal(decline.status, 200);
    assert.equal(
      await db.communityMembership.count({
        where: { communityId: privateCommunity.id, userId: declined.userId, leftAt: null },
      }),
      0,
    );

    const resubmit = await fetch(`${base}/api/v1/communities/${privateCommunity.id}/join`, {
      method: "POST",
      headers: headers(declined.cookie),
    });
    assert.equal(resubmit.status, 202);
    assert.equal(
      await db.communityJoinRequest.count({
        where: { communityId: privateCommunity.id, userId: declined.userId, status: "PENDING" },
      }),
      1,
    );
    const cancel = await fetch(`${base}/api/v1/communities/${privateCommunity.id}/join-request`, {
      method: "DELETE",
      headers: headers(declined.cookie),
    });
    assert.equal(cancel.status, 200);
    assert.equal(
      await db.communityJoinRequest.count({
        where: { communityId: privateCommunity.id, userId: declined.userId, status: "CANCELLED" },
      }),
      1,
    );

    const directJoinRequest = await fetch(
      `${base}/api/v1/communities/${privateCommunity.id}/join`,
      {
        method: "POST",
        headers: headers(direct.cookie),
      },
    );
    assert.equal(directJoinRequest.status, 202);
    const directAdd = await fetch(`${base}/api/v1/communities/${privateCommunity.id}/members`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ username: direct.username }),
    });
    assert.equal(directAdd.status, 201);
    assert.equal(
      await db.communityMembership.count({
        where: { communityId: privateCommunity.id, userId: direct.userId, leftAt: null },
      }),
      1,
    );
    assert.equal(
      await db.communityJoinRequest.count({
        where: { communityId: privateCommunity.id, userId: direct.userId, status: "APPROVED" },
      }),
      1,
    );
  } finally {
    await db.communityJoinRequest.deleteMany({
      where: { communityId: { in: createdCommunityIds } },
    });
    await db.communityMembership.deleteMany({
      where: { communityId: { in: createdCommunityIds } },
    });
    await db.community.deleteMany({ where: { id: { in: createdCommunityIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
