import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for Play player-listing integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});

const db = getDatabaseClient();
const suffix = `play-${Date.now()}`;
const createdUserIds: string[] = [];

async function register(base: string, label: string) {
  const loginUsername = `${suffix}-${label}`;
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername,
      password: "correct horse battery staple",
      displayUsername: loginUsername,
      displayName: `Play ${label}`,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  const credential = await db.webCredential.findUnique({
    where: { loginUsername },
    select: { userId: true },
  });
  assert.ok(credential);
  createdUserIds.push(credential.userId);
  return { cookie, userId: credential.userId, username: loginUsername };
}

function authenticated(cookie: string, method: "PUT" | "DELETE", body?: unknown) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  } as RequestInit;
}

async function cleanup() {
  if (!createdUserIds.length) return;
  await db.playPlayerListing.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.telegramIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.platformRoleAssignment.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
}

async function startApp() {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("Play player listings are public while lifecycle is account-owned and membership-independent", async () => {
  await cleanup();
  const { server, base } = await startApp();

  try {
    const initialPublic = await fetch(`${base}/api/public/v1/play/player-listings`);
    assert.equal(initialPublic.status, 200);

    const anonymousWrite = await fetch(
      `${base}/api/v1/play/player-listing`,
      authenticated("", "PUT", { lookingFor: "GAME" }),
    );
    assert.equal(anonymousWrite.status, 401);

    const playerA = await register(base, "a");
    assert.equal(await db.communityMembership.count({ where: { userId: playerA.userId } }), 0);
    assert.equal(await db.teamPlayer.count({ where: { userId: playerA.userId } }), 0);
    assert.equal(await db.gamerProfile.count({ where: { userId: playerA.userId } }), 0);

    const createA = await fetch(
      `${base}/api/v1/play/player-listing`,
      authenticated(playerA.cookie, "PUT", { lookingFor: "GAME" }),
    );
    assert.equal(createA.status, 200);
    const listingA = (await createA.json()) as { id: string; lookingFor: string };
    assert.equal(listingA.lookingFor, "GAME");
    assert.equal(await db.playPlayerListing.count({ where: { userId: playerA.userId } }), 1);

    const publicAfterCreate = await fetch(`${base}/api/public/v1/play/player-listings`);
    assert.equal(publicAfterCreate.status, 200);
    const publicBody = (await publicAfterCreate.json()) as {
      items: Array<
        Record<string, unknown> & {
          id: string;
          lookingFor: string;
          presentation: {
            username: string;
            displayName: string;
            photoUrl: string | null;
            bio: string | null;
          } | null;
        }
      >;
    };
    const publicA = publicBody.items.find((item) => item.id === listingA.id);
    assert.ok(publicA);
    assert.equal(publicA.lookingFor, "GAME");
    assert.equal(publicA.presentation?.username, playerA.username);
    assert.equal(publicA.presentation?.displayName, "Play a");
    assert.deepEqual(Object.keys(publicA).sort(), [
      "id",
      "lookingFor",
      "presentation",
      "updatedAt",
    ]);
    assert.equal("userId" in publicA, false);

    const updateA = await fetch(
      `${base}/api/v1/play/player-listing`,
      authenticated(playerA.cookie, "PUT", { lookingFor: "TEAM" }),
    );
    assert.equal(updateA.status, 200);
    const updatedA = (await updateA.json()) as { id: string; lookingFor: string };
    assert.equal(updatedA.id, listingA.id);
    assert.equal(updatedA.lookingFor, "TEAM");
    assert.equal(await db.playPlayerListing.count({ where: { userId: playerA.userId } }), 1);

    const playerB = await register(base, "b");
    const createB = await fetch(
      `${base}/api/v1/play/player-listing`,
      authenticated(playerB.cookie, "PUT", { lookingFor: "GAME" }),
    );
    assert.equal(createB.status, 200);
    const listingB = (await createB.json()) as { id: string };

    const removeA = await fetch(
      `${base}/api/v1/play/player-listing`,
      authenticated(playerA.cookie, "DELETE"),
    );
    assert.equal(removeA.status, 200);
    assert.equal(await db.playPlayerListing.count({ where: { userId: playerA.userId } }), 0);
    assert.equal(await db.playPlayerListing.count({ where: { userId: playerB.userId } }), 1);
    assert.ok(await db.playPlayerListing.findUnique({ where: { id: listingB.id } }));

    const finalPublic = await fetch(`${base}/api/public/v1/play/player-listings`);
    assert.equal(finalPublic.status, 200);
    const finalBody = (await finalPublic.json()) as { items: Array<{ id: string }> };
    assert.equal(
      finalBody.items.some((item) => item.id === listingA.id),
      false,
    );
    assert.equal(
      finalBody.items.some((item) => item.id === listingB.id),
      true,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await cleanup();
  }
});
