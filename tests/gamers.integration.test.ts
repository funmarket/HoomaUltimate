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
  await db.gamerGame.deleteMany({ where: { createdByUserId: { not: null } } });
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
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

async function startApp() {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("Gamers catalog is public, persisted, authenticated for writes and duplicate-safe", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const publicList = await fetch(`${base}/api/public/v1/gamers/games`);
    assert.equal(publicList.status, 200);
    const publicBody = (await publicList.json()) as {
      items: Array<{ id: string; slug: string; name: string; status: string }>;
    };
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

test("GamerProfile is private per account while Challengers is public and privacy-safe", async () => {
  await resetTestData();
  const { server, base } = await startApp();

  try {
    const gamesResponse = await fetch(`${base}/api/public/v1/gamers/games`);
    assert.equal(gamesResponse.status, 200);
    const games = (await gamesResponse.json()) as {
      items: Array<{ id: string; slug: string; name: string }>;
    };
    const fc = games.items.find((game) => game.slug === "ea-sports-fc-mobile");
    const ludo = games.items.find((game) => game.slug === "ludo");
    assert.ok(fc);
    assert.ok(ludo);

    const anonymousOwnRead = await fetch(`${base}/api/v1/gamers/games/${fc.id}/profile`);
    assert.equal(anonymousOwnRead.status, 401);
    const anonymousOwnWrite = await fetch(`${base}/api/v1/gamers/games/${fc.id}/profile`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({ handle: "Anonymous", openToChallenge: true }),
    });
    assert.equal(anonymousOwnWrite.status, 401);

    const openCookie = await register(base, "open-player");
    const closedCookie = await register(base, "closed-player");

    const closedCreate = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/profile`,
      authenticatedProfile(closedCookie, { handle: "Closed FC", openToChallenge: false }),
    );
    assert.equal(closedCreate.status, 200);

    const openCreate = await fetch(
      `${base}/api/v1/gamers/games/${fc.id}/profile`,
      authenticatedProfile(openCookie, { handle: "  Tunisia   FC  ", openToChallenge: true }),
    );
    assert.equal(openCreate.status, 200);
    const openProfile = (await openCreate.json()) as {
      id: string;
      userId: string;
      gameId: string;
      handle: string;
      openToChallenge: boolean;
    };
    assert.equal(openProfile.handle, "Tunisia FC");
    assert.equal(openProfile.gameId, fc.id);
    assert.equal(openProfile.openToChallenge, true);

    const publicChallengers = await fetch(
      `${base}/api/public/v1/gamers/games/${fc.id}/challengers`,
    );
    assert.equal(publicChallengers.status, 200);
    const challengerBody = (await publicChallengers.json()) as {
      items: Array<{
        id: string;
        handle: string;
        presentation: { username: string; displayName: string; photoUrl: string | null };
      }>;
    };
    assert.equal(challengerBody.items.length, 1);
    assert.equal(challengerBody.items[0]?.id, openProfile.id);
    assert.equal(challengerBody.items[0]?.handle, "Tunisia FC");
    assert.equal(challengerBody.items[0]?.presentation.username, "gamer-open-player");
    assert.equal(challengerBody.items[0]?.presentation.displayName, "Gamer open-player");
    assert.deepEqual(Object.keys(challengerBody.items[0] ?? {}).sort(), [
      "handle",
      "id",
      "presentation",
    ]);
    assert.equal("userId" in (challengerBody.items[0] ?? {}), false);
    assert.equal("gameId" in (challengerBody.items[0] ?? {}), false);
    assert.equal("openToChallenge" in (challengerBody.items[0] ?? {}), false);
    assert.equal("createdAt" in (challengerBody.items[0] ?? {}), false);
    assert.equal("updatedAt" in (challengerBody.items[0] ?? {}), false);

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

    const ludoProfile = await fetch(
      `${base}/api/v1/gamers/games/${ludo.id}/profile`,
      authenticatedProfile(openCookie, { handle: "FunKing", openToChallenge: true }),
    );
    assert.equal(ludoProfile.status, 200);
    assert.equal(await db.gamerProfile.count({ where: { userId: openProfile.userId } }), 2);

    const inactiveGameCreate = await fetch(
      `${base}/api/v1/gamers/games`,
      authenticatedJson(openCookie, "Dormant Test Game"),
    );
    assert.equal(inactiveGameCreate.status, 201);
    const inactiveGame = (await inactiveGameCreate.json()) as { id: string };
    await db.gamerGame.update({ where: { id: inactiveGame.id }, data: { status: "INACTIVE" } });

    const inactivePublic = await fetch(
      `${base}/api/public/v1/gamers/games/${inactiveGame.id}/challengers`,
    );
    assert.equal(inactivePublic.status, 404);
    const inactivePrivate = await fetch(
      `${base}/api/v1/gamers/games/${inactiveGame.id}/profile`,
      authenticatedProfile(openCookie, { handle: "Should Fail", openToChallenge: true }),
    );
    assert.equal(inactivePrivate.status, 404);
    assert.equal(await db.gamerProfile.count({ where: { gameId: inactiveGame.id } }), 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});
