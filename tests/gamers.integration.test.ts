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

async function register(base: string) {
  const response = await fetch(`${base}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: "gamer-catalog-owner",
      password: "correct horse battery staple",
      displayUsername: "gamer-catalog-owner",
      displayName: "Catalog Gamer",
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

test("Gamers catalog is public, persisted, authenticated for writes and duplicate-safe", async () => {
  await resetTestData();
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const publicList = await fetch(`${base}/api/public/v1/gamers/games`);
    assert.equal(publicList.status, 200);
    const publicBody = (await publicList.json()) as {
      items: Array<{ slug: string; name: string; status: string }>;
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
    assert.deepEqual(
      concurrent.map((response) => response.status).sort(),
      [201, 409],
    );
    assert.equal(
      await db.gamerGame.count({ where: { normalizedName: "street fighter 6" } }),
      1,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await resetTestData();
  }
});
