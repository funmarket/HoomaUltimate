import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Gamers integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});

const db = getDatabaseClient();

async function resetTestData() {
  await db.gamerChallenge.deleteMany();
  await db.gamerGame.deleteMany({ where: { createdByUserId: { not: null } } });
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

async function enableGamerIdentity(base: string, cookie: string) {
  const response = await fetch(`${base}/api/v1/me/profile/identities/gamer`, {
    method: "POST",
    headers: { cookie, origin: config.WEB_ORIGIN },
  });
  assert.equal(response.status, 200);
  const profile = (await response.json()) as { identities: string[] };
  assert.ok(profile.identities.includes("GAMER"));
  return profile;
}

async function register(base: string, suffix = "catalog-owner") {
  const username = `gamer-${suffix}`;
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      password: "correct horse battery staple",
      displayUsername: username,
      displayName: `Gamer ${suffix}`,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  await enableGamerIdentity(base, cookie);
  return cookie;
}

function authenticatedJson(cookie: string, name: string) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    body: JSON.stringify({ name }),
  } as const;
}

function authenticatedProfile(cookie: string, input: { handle: string; openToChallenge: boolean }) {
  return {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    body: JSON.stringify(input),
  } as const;
}

function authenticatedPost(cookie: string, body?: unknown) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  } as const;
}

async function startApp() {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function activeGames(base: string) {
  const response = await fetch(`${base}/api/public/v1/gamers/games`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    items: Array<{ id: string; slug: string; name: string; status: string }>;
  };
  return body.items;
}

async function createProfile(
  base: string,
  cookie: string,
  gameId: string,
  handle: string,
  openToChallenge = true,
) {
  const response = await fetch(
    `${base}/api/v1/gamers/games/${gameId}/profile`,
    authenticatedProfile(cookie, { handle, openToChallenge }),
  );
  assert.equal(response.status, 200);
  return (await response.json()) as {
    id: string;
    userId: string;
    gameId: string;
    handle: string;
    openToChallenge: boolean;
  };
}

test("Gamer enrollment is additive, idempotent and leaves canonical presentation unchanged", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const username = "gamer-enrollment";
    const registerResponse = await fetch(`${base}/api/public/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: username,
        password: "correct horse battery staple",
        displayUsername: username,
        displayName: "Enrollment Gamer",
      }),
    });
    assert.equal(registerResponse.status, 201);
    const cookie = registerResponse.headers.get("set-cookie");
    assert.ok(cookie);

    const beforeResponse = await fetch(`${base}/api/v1/me/profile`, {
      headers: { cookie, origin: config.WEB_ORIGIN },
    });
    assert.equal(beforeResponse.status, 200);
    const before = (await beforeResponse.json()) as {
      presentation: Record<string, unknown>;
      identities: string[];
    };

    const first = await enableGamerIdentity(base, cookie);
    const second = await enableGamerIdentity(base, cookie);
    assert.equal(first.identities.filter((identity) => identity === "GAMER").length, 1);
    assert.equal(second.identities.filter((identity) => identity === "GAMER").length, 1);

    const afterResponse = await fetch(`${base}/api/v1/me/profile`, {
      headers: { cookie, origin: config.WEB_ORIGIN },
    });
    assert.equal(afterResponse.status, 200);
    const after = (await afterResponse.json()) as {
      presentation: Record<string, unknown>;
      identities: string[];
    };
    assert.deepEqual(after.presentation, before.presentation);
    assert.ok(after.identities.includes("GAMER"));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});

test("Gamers catalog is public, persisted, authenticated for writes and duplicate-safe", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const publicBody = { items: await activeGames(base) };
    assert.ok(
      publicBody.items.some(
        (game) => game.slug === "ea-sports-fc-mobile" && game.name === "EA SPORTS FC Mobile",
      ),
    );
    assert.ok(publicBody.items.some((game) => game.slug === "ludo" && game.name === "Ludo"));

    const publicDetail = await fetch(`${base}/api/public/v1/gamers/games/ea-sports-fc-mobile`);
    assert.equal(publicDetail.status, 200);

    const unauthenticatedWrite = await fetch(`${base}/api/v1/gamers/games`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ name: "Rocket League" }),
    });
    assert.equal(unauthenticatedWrite.status, 401);

    const cookie = await register(base);
    const create = await fetch(
      `${base}/api/v1/gamers/games`,
      authenticatedJson(cookie, "Rocket League"),
    );
    assert.equal(create.status, 201);
    const created = (await create.json()) as { slug: string; name: string };
    assert.equal(created.name, "Rocket League");
    assert.equal(created.slug, "rocket-league");

    const duplicateSeed = await fetch(
      `${base}/api/v1/gamers/games`,
      authenticatedJson(cookie, " EA SPORTS: FC MOBILE "),
    );
    assert.equal(duplicateSeed.status, 409);

    const concurrent = await Promise.all([
      fetch(`${base}/api/v1/gamers/games`, authenticatedJson(cookie, "Street Fighter 6")),
      fetch(`${base}/api/v1/gamers/games`, authenticatedJson(cookie, "Street-Fighter 6")),
    ]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    assert.equal(await db.gamerGame.count({ where: { normalizedName: "street fighter 6" } }), 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});

test("global Gamer discovery includes real active profiles while Challengers stays open-only", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const games = await activeGames(base);
    const fc = games.find((game) => game.slug === "ea-sports-fc-mobile");
    const ludo = games.find((game) => game.slug === "ludo");
    assert.ok(fc);
    assert.ok(ludo);

    const openCookie = await register(base, "open-player");
    const closedCookie = await register(base, "closed-player");
    const openProfile = await createProfile(base, openCookie, fc.id, "Tunisia FC", true);
    const closedProfile = await createProfile(base, closedCookie, fc.id, "Closed FC", false);
    await createProfile(base, openCookie, ludo.id, "FunKing", true);

    const publicChallengers = await fetch(
      `${base}/api/public/v1/gamers/games/${fc.id}/challengers`,
    );
    assert.equal(publicChallengers.status, 200);
    const challengerBody = (await publicChallengers.json()) as {
      items: Array<{ id: string; handle: string }>;
    };
    assert.ok(challengerBody.items.some((item) => item.id === openProfile.id));
    assert.equal(challengerBody.items.some((item) => item.id === closedProfile.id), false);

    const discoveryResponse = await fetch(`${base}/api/public/v1/gamers/discovery`);
    assert.equal(discoveryResponse.status, 200);
    const discovery = (await discoveryResponse.json()) as {
      items: Array<{
        id: string;
        handle: string;
        openToChallenge: boolean;
        game: { id: string; slug: string; name: string };
        presentation: { username: string; displayName: string; photoUrl: string | null };
      }>;
    };
    const openDiscovery = discovery.items.find((item) => item.id === openProfile.id);
    const closedDiscovery = discovery.items.find((item) => item.id === closedProfile.id);
    assert.ok(openDiscovery);
    assert.ok(closedDiscovery);
    assert.equal(openDiscovery.openToChallenge, true);
    assert.equal(closedDiscovery.openToChallenge, false);
    assert.equal(openDiscovery.game.id, fc.id);
    assert.equal(openDiscovery.game.slug, fc.slug);
    assert.deepEqual(Object.keys(openDiscovery).sort(), [
      "game",
      "handle",
      "id",
      "openToChallenge",
      "presentation",
    ]);
    assert.equal("userId" in openDiscovery, false);
    assert.equal("createdAt" in openDiscovery, false);

    const retiredProfileRoute = await fetch(
      `${base}/api/public/v1/gamers/games/${fc.id}/profiles/${openProfile.id}`,
    );
    assert.equal(retiredProfileRoute.status, 404);

    const updateSameProfile = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/profile`,
      authenticatedProfile(openCookie, { handle: "Tunisia FC Updated", openToChallenge: true }),
    );
    assert.equal(updateSameProfile.status, 200);
    const updated = (await updateSameProfile.json()) as { id: string; handle: string };
    assert.equal(updated.id, openProfile.id);
    assert.equal(updated.handle, "Tunisia FC Updated");
    assert.equal(
      await db.gamerProfile.count({ where: { userId: openProfile.userId, gameId: fc.id } }),
      1,
    );

    const inactiveGameCreate = await fetch(
      `${base}/api/v1/gamers/games`,
      authenticatedJson(openCookie, "Dormant Test Game"),
    );
    assert.equal(inactiveGameCreate.status, 201);
    const inactiveGame = (await inactiveGameCreate.json()) as { id: string };
    const inactiveProfile = await createProfile(
      base,
      openCookie,
      inactiveGame.id,
      "Dormant Gamer",
      true,
    );
    await db.gamerGame.update({ where: { id: inactiveGame.id }, data: { status: "INACTIVE" } });

    const discoveryAfterInactive = await fetch(`${base}/api/public/v1/gamers/discovery`);
    assert.equal(discoveryAfterInactive.status, 200);
    const afterInactive = (await discoveryAfterInactive.json()) as {
      items: Array<{ id: string }>;
    };
    assert.equal(afterInactive.items.some((item) => item.id === inactiveProfile.id), false);

    const inactivePublic = await fetch(
      `${base}/api/public/v1/gamers/games/${inactiveGame.id}/challengers`,
    );
    assert.equal(inactivePublic.status, 404);
    const inactivePrivate = await fetch(
      `${base}/api/v1/gamers/games/${inactiveGame.id}/profile`,
      authenticatedProfile(openCookie, { handle: "Should Fail", openToChallenge: true }),
    );
    assert.equal(inactivePrivate.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});

test("G3 challenges enforce ownership, same-game/open rules, duplicate safety and Arena lifecycle", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const games = await activeGames(base);
    const fc = games.find((game) => game.slug === "ea-sports-fc-mobile");
    const ludo = games.find((game) => game.slug === "ludo");
    assert.ok(fc);
    assert.ok(ludo);

    const aliceCookie = await register(base, "g3-alice");
    const bobCookie = await register(base, "g3-bob");
    const carolCookie = await register(base, "g3-carol");
    const noProfileCookie = await register(base, "g3-no-profile");

    const alice = await createProfile(base, aliceCookie, fc.id, "Alice FC");
    const bob = await createProfile(base, bobCookie, fc.id, "Bob FC");
    const carol = await createProfile(base, carolCookie, fc.id, "Carol FC", false);
    const bobLudo = await createProfile(base, bobCookie, ludo.id, "Bob Ludo");

    const anonymousChallenge = await fetch(`${base}/api/v1/gamers/games/${fc.id}/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ challengedProfileId: bob.id }),
    });
    assert.equal(anonymousChallenge.status, 401);

    const withoutProfile = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(noProfileCookie, { challengedProfileId: bob.id }),
    );
    assert.equal(withoutProfile.status, 409);

    const selfChallenge = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: alice.id }),
    );
    assert.equal(selfChallenge.status, 400);

    const crossGame = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: bobLudo.id }),
    );
    assert.equal(crossGame.status, 404);

    const closedTarget = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: carol.id }),
    );
    assert.equal(closedTarget.status, 409);

    const first = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: bob.id }),
    );
    assert.equal(first.status, 201);
    const challenge = (await first.json()) as {
      id: string;
      status: string;
      challenger: { id: string };
      challenged: { id: string };
    };
    assert.equal(challenge.status, "PENDING");
    assert.equal(challenge.challenger.id, alice.id);
    assert.equal(challenge.challenged.id, bob.id);

    const sameDirectionDuplicate = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: bob.id }),
    );
    assert.equal(sameDirectionDuplicate.status, 409);

    const reverseDirectionDuplicate = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(bobCookie, { challengedProfileId: alice.id }),
    );
    assert.equal(reverseDirectionDuplicate.status, 409);
    assert.equal(
      await db.gamerChallenge.count({ where: { gameId: fc.id, status: "PENDING" } }),
      1,
    );

    const forbiddenAccept = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/accept`,
      authenticatedPost(aliceCookie),
    );
    assert.equal(forbiddenAccept.status, 403);

    const forbiddenCancel = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/cancel`,
      authenticatedPost(bobCookie),
    );
    assert.equal(forbiddenCancel.status, 403);

    const accept = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/accept`,
      authenticatedPost(bobCookie),
    );
    assert.equal(accept.status, 200);
    assert.equal(((await accept.json()) as { status: string }).status, "ACCEPTED");

    const repeatedAccept = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/accept`,
      authenticatedPost(bobCookie),
    );
    assert.equal(repeatedAccept.status, 200);

    const declineAccepted = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/decline`,
      authenticatedPost(bobCookie),
    );
    assert.equal(declineAccepted.status, 409);
    const cancelAccepted = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${challenge.id}/cancel`,
      authenticatedPost(aliceCookie),
    );
    assert.equal(cancelAccepted.status, 409);

    const aliceArena = await fetch(`${base}/api/v1/gamers/games/${fc.id}/challenges`, {
      headers: { cookie: aliceCookie, origin: config.WEB_ORIGIN },
    });
    assert.equal(aliceArena.status, 200);
    const arenaBody = (await aliceArena.json()) as { items: Array<{ id: string; status: string }> };
    assert.ok(arenaBody.items.some((item) => item.id === challenge.id && item.status === "ACCEPTED"));

    const second = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: bob.id }),
    );
    assert.equal(second.status, 201);
    const secondChallenge = (await second.json()) as { id: string };
    const cancel = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${secondChallenge.id}/cancel`,
      authenticatedPost(aliceCookie),
    );
    assert.equal(cancel.status, 200);
    assert.equal(((await cancel.json()) as { status: string }).status, "CANCELLED");

    const third = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(bobCookie, { challengedProfileId: alice.id }),
    );
    assert.equal(third.status, 201);
    const thirdChallenge = (await third.json()) as { id: string };
    const decline = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${thirdChallenge.id}/decline`,
      authenticatedPost(aliceCookie),
    );
    assert.equal(decline.status, 200);
    assert.equal(((await decline.json()) as { status: string }).status, "DECLINED");

    const fourth = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges`,
      authenticatedPost(aliceCookie, { challengedProfileId: bob.id }),
    );
    assert.equal(fourth.status, 201);
    const fourthChallenge = (await fourth.json()) as { id: string };
    await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/challenges/${fourthChallenge.id}/cancel`,
      authenticatedPost(aliceCookie),
    );

    const concurrentPair = await Promise.all([
      fetch(
        `${base}/api/v1/gamers/games/${fc.id}/challenges`,
        authenticatedPost(aliceCookie, { challengedProfileId: bob.id }),
      ),
      fetch(
        `${base}/api/v1/gamers/games/${fc.id}/challenges`,
        authenticatedPost(bobCookie, { challengedProfileId: alice.id }),
      ),
    ]);
    assert.deepEqual(concurrentPair.map((response) => response.status).sort(), [201, 409]);
    assert.equal(
      await db.gamerChallenge.count({ where: { gameId: fc.id, status: "PENDING" } }),
      1,
    );

    const inactiveCreate = await fetch(
      `${base}/api/v1/gamers/games`,
      authenticatedJson(aliceCookie, "Inactive G3 Game"),
    );
    assert.equal(inactiveCreate.status, 201);
    const inactive = (await inactiveCreate.json()) as { id: string };
    await db.gamerGame.update({ where: { id: inactive.id }, data: { status: "INACTIVE" } });
    const inactiveChallenges = await fetch(
      `${base}/api/v1/gamers/games/${inactive.id}/challenges`,
      { headers: { cookie: aliceCookie, origin: config.WEB_ORIGIN } },
    );
    assert.equal(inactiveChallenges.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});
