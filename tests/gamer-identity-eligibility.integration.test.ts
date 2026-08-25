import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for Gamer identity integration tests");

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
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

async function startApp() {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function register(base: string, suffix: string) {
  const username = `identity-${suffix}`;
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      password: "correct horse battery staple",
      displayUsername: username,
      displayName: `Identity ${suffix}`,
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  return cookie;
}

async function setIdentities(
  base: string,
  cookie: string,
  identities: Array<"PLAYER" | "FAN" | "GAMER">,
) {
  const currentResponse = await fetch(`${base}/api/v1/me/profile`, {
    headers: { cookie, origin: config.WEB_ORIGIN },
  });
  assert.equal(currentResponse.status, 200);
  const current = (await currentResponse.json()) as {
    presentation: {
      username: string;
      displayName: string;
      photoUrl: string | null;
      bio: string | null;
    };
    player: {
      skillLevel: string;
      preferredPositions: string[];
    } | null;
  };

  const response = await fetch(`${base}/api/v1/me/profile`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    body: JSON.stringify({
      username: current.presentation.username,
      displayName: current.presentation.displayName,
      photoUrl: current.presentation.photoUrl,
      bio: current.presentation.bio,
      identities,
      player: identities.includes("PLAYER")
        ? current.player && {
            skillLevel: current.player.skillLevel,
            preferredPositions: current.player.preferredPositions,
          }
        : null,
    }),
  });
  assert.equal(response.status, 200);
}

async function activeGames(base: string) {
  const response = await fetch(`${base}/api/public/v1/gamers/games`);
  assert.equal(response.status, 200);
  return (await response.json()) as {
    items: Array<{ id: string; slug: string; name: string }>;
  };
}

async function saveGamerProfile(
  base: string,
  cookie: string,
  gameId: string,
  handle: string,
) {
  return fetch(`${base}/api/v1/gamers/games/${gameId}/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: config.WEB_ORIGIN,
    },
    body: JSON.stringify({ handle, openToChallenge: true }),
  });
}

test(
  "canonical GAMER identity gates participation while signup-style onboarding can precreate game profiles",
  async () => {
    await resetTestData();
    const { server, base } = await startApp();

    try {
      const games = await activeGames(base);
      const fc = games.items.find((game) => game.slug === "ea-sports-fc-mobile");
      const ludo = games.items.find((game) => game.slug === "ludo");
      assert.ok(fc);
      assert.ok(ludo);

      const targetCookie = await register(base, "target");

      const withoutGamerIdentity = await saveGamerProfile(
        base,
        targetCookie,
        fc.id,
        "Target FC",
      );
      assert.equal(withoutGamerIdentity.status, 409);
      const identityError = (await withoutGamerIdentity.json()) as {
        error?: { code?: string };
      };
      assert.equal(identityError.error?.code, "GAMER_IDENTITY_REQUIRED");

      await setIdentities(base, targetCookie, ["GAMER"]);

      const fcProfileResponse = await saveGamerProfile(base, targetCookie, fc.id, "Target FC");
      assert.equal(fcProfileResponse.status, 200);
      const fcProfile = (await fcProfileResponse.json()) as { id: string; userId: string };

      const ludoProfileResponse = await saveGamerProfile(
        base,
        targetCookie,
        ludo.id,
        "Target Ludo",
      );
      assert.equal(ludoProfileResponse.status, 200);
      assert.equal(await db.gamerProfile.count({ where: { userId: fcProfile.userId } }), 2);

      const visibleResponse = await fetch(
        `${base}/api/public/v1/gamers/games/${fc.id}/challengers`,
      );
      assert.equal(visibleResponse.status, 200);
      const visible = (await visibleResponse.json()) as { items: Array<{ id: string }> };
      assert.ok(visible.items.some((item) => item.id === fcProfile.id));

      await setIdentities(base, targetCookie, []);

      const hiddenResponse = await fetch(
        `${base}/api/public/v1/gamers/games/${fc.id}/challengers`,
      );
      assert.equal(hiddenResponse.status, 200);
      const hidden = (await hiddenResponse.json()) as { items: Array<{ id: string }> };
      assert.equal(hidden.items.some((item) => item.id === fcProfile.id), false);
      assert.equal(await db.gamerProfile.count({ where: { userId: fcProfile.userId } }), 2);

      const challengerCookie = await register(base, "challenger");
      await setIdentities(base, challengerCookie, ["GAMER"]);
      const challengerProfileResponse = await saveGamerProfile(
        base,
        challengerCookie,
        fc.id,
        "Challenger FC",
      );
      assert.equal(challengerProfileResponse.status, 200);

      const challengeResponse = await fetch(
        `${base}/api/v1/gamers/games/${fc.id}/challenges`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: challengerCookie,
            origin: config.WEB_ORIGIN,
          },
          body: JSON.stringify({ challengedProfileId: fcProfile.id }),
        },
      );
      assert.equal(challengeResponse.status, 409);
      const targetError = (await challengeResponse.json()) as { error?: { code?: string } };
      assert.equal(targetError.error?.code, "GAMER_CHALLENGE_TARGET_INELIGIBLE");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await resetTestData();
    }
  },
);