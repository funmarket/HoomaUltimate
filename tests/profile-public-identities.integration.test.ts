import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for profile identity integration tests");

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
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.auditLog.deleteMany();
  await db.playerProfile.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
}

async function register(base: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: "passport-owner",
      password: "correct horse battery staple",
      displayUsername: "passport-owner",
      displayName: "Passport Owner",
    }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes(`${config.SESSION_COOKIE_NAME}=`));
  return cookie;
}

async function updateProfile(
  base: string,
  cookie: string,
  input: {
    identities: Array<"PLAYER" | "FAN" | "GAMER">;
    player: { skillLevel: string; preferredPositions: string[] } | null;
  },
) {
  const response = await fetch(`${base}/api/v1/me/profile`, {
    method: "PATCH",
    headers: {
      cookie,
      origin: config.WEB_ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "passport-owner",
      displayName: "Passport Owner",
      photoUrl: null,
      bio: "One canonical HOOMA Passport",
      identities: input.identities,
      player: input.player,
    }),
  });
  assert.equal(response.status, 200);
  return response;
}

async function publicProfile(base: string) {
  const response = await fetch(`${base}/api/public/v1/profiles/passport-owner`);
  assert.equal(response.status, 200);
  return (await response.json()) as {
    identities: string[];
    player: {
      skillLevel: string;
      preferredPositions: string[];
      overallRating: number;
    } | null;
  };
}

test("public Passport projects canonical identities and only exposes Player details for PLAYER", async () => {
  await resetDatabase();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await register(base);

    const initial = await publicProfile(base);
    assert.deepEqual(initial.identities, []);
    assert.equal(initial.player, null);

    await updateProfile(base, cookie, {
      identities: ["FAN", "GAMER"],
      player: null,
    });
    const fanGamer = await publicProfile(base);
    assert.deepEqual(fanGamer.identities, ["FAN", "GAMER"]);
    assert.equal(fanGamer.player, null);

    await updateProfile(base, cookie, {
      identities: ["PLAYER", "FAN", "GAMER"],
      player: { skillLevel: "INTERMEDIATE", preferredPositions: ["CM", "AM"] },
    });
    const playerFanGamer = await publicProfile(base);
    assert.deepEqual(playerFanGamer.identities, ["PLAYER", "FAN", "GAMER"]);
    assert.deepEqual(playerFanGamer.player, {
      skillLevel: "INTERMEDIATE",
      preferredPositions: ["CM", "AM"],
      overallRating: 50,
    });

    await updateProfile(base, cookie, { identities: [], player: null });
    const ghostRider = await publicProfile(base);
    assert.deepEqual(ghostRider.identities, []);
    assert.equal(ghostRider.player, null);

    const user = await db.user.findFirst({
      where: { presentation: { username: "passport-owner" } },
      select: { identities: true, playerProfile: { select: { userId: true } } },
    });
    assert.ok(user);
    assert.deepEqual(user.identities, []);
    assert.ok(user.playerProfile);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetDatabase();
  }
});
