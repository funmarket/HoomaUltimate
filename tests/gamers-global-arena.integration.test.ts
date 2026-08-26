import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Gamers Arena integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});

const db = getDatabaseClient();
const prefix = "arena-projection-";

async function startApp() {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function cleanup() {
  const users = await db.userPresentation.findMany({
    where: { username: { startsWith: prefix } },
    select: { userId: true },
  });
  const userIds = users.map((item) => item.userId);
  if (userIds.length) {
    await db.gamerChallenge.deleteMany({
      where: {
        OR: [
          { challengerProfile: { userId: { in: userIds } } },
          { challengedProfile: { userId: { in: userIds } } },
        ],
      },
    });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await db.gamerGame.deleteMany({ where: { slug: `${prefix}inactive` } });
}

async function createGamer(gameId: string, suffix: string) {
  const username = `${prefix}${suffix}`;
  const photoUrl = `https://example.com/${suffix}.jpg`;
  const user = await db.user.create({
    data: {
      identities: ["GAMER"],
      presentation: {
        create: {
          username,
          displayName: `Arena ${suffix}`,
          photoUrl,
        },
      },
    },
  });
  const profile = await db.gamerProfile.create({
    data: {
      userId: user.id,
      gameId,
      handle: `${suffix}-tag`,
      openToChallenge: true,
    },
  });
  return { user, profile, username, photoUrl };
}

test(
  "global Gamer Arena is public, accepted-only, cross-game and uses canonical profile photos",
  async () => {
    await cleanup();
    const { server, base } = await startApp();

    try {
      const fc = await db.gamerGame.findUnique({ where: { slug: "ea-sports-fc-mobile" } });
      const ludo = await db.gamerGame.findUnique({ where: { slug: "ludo" } });
      assert.ok(fc);
      assert.ok(ludo);

      const inactiveGame = await db.gamerGame.create({
        data: {
          slug: `${prefix}inactive`,
          name: "Inactive Arena Fixture",
          normalizedName: `${prefix}inactive`,
          status: "INACTIVE",
        },
      });

      const fcA = await createGamer(fc.id, "fc-a");
      const fcB = await createGamer(fc.id, "fc-b");
      const ludoA = await createGamer(ludo.id, "ludo-a");
      const ludoB = await createGamer(ludo.id, "ludo-b");
      const inactiveA = await createGamer(inactiveGame.id, "inactive-a");
      const inactiveB = await createGamer(inactiveGame.id, "inactive-b");

      const acceptedFc = await db.gamerChallenge.create({
        data: {
          gameId: fc.id,
          challengerProfileId: fcA.profile.id,
          challengedProfileId: fcB.profile.id,
          pairKey: [fcA.profile.id, fcB.profile.id].sort().join(":"),
          status: "ACCEPTED",
          respondedAt: new Date("2026-08-26T08:00:00.000Z"),
        },
      });
      const acceptedLudo = await db.gamerChallenge.create({
        data: {
          gameId: ludo.id,
          challengerProfileId: ludoA.profile.id,
          challengedProfileId: ludoB.profile.id,
          pairKey: [ludoA.profile.id, ludoB.profile.id].sort().join(":"),
          status: "ACCEPTED",
          respondedAt: new Date("2026-08-26T09:00:00.000Z"),
        },
      });
      await db.gamerChallenge.create({
        data: {
          gameId: fc.id,
          challengerProfileId: fcA.profile.id,
          challengedProfileId: fcB.profile.id,
          pairKey: [fcA.profile.id, fcB.profile.id].sort().join(":"),
          status: "PENDING",
        },
      });
      const inactiveAccepted = await db.gamerChallenge.create({
        data: {
          gameId: inactiveGame.id,
          challengerProfileId: inactiveA.profile.id,
          challengedProfileId: inactiveB.profile.id,
          pairKey: [inactiveA.profile.id, inactiveB.profile.id].sort().join(":"),
          status: "ACCEPTED",
          respondedAt: new Date("2026-08-26T10:00:00.000Z"),
        },
      });

      const response = await fetch(`${base}/api/public/v1/gamers/arena`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        items: Array<{
          id: string;
          status: string;
          game: { id: string; slug: string; name: string };
          challenger: {
            id: string;
            handle: string;
            presentation: { username: string; displayName: string; photoUrl: string | null };
          };
          challenged: {
            id: string;
            handle: string;
            presentation: { username: string; displayName: string; photoUrl: string | null };
          };
        }>;
      };

      const fixtureMatches = body.items.filter((item) =>
        item.challenger.presentation.username.startsWith(prefix),
      );
      assert.deepEqual(
        fixtureMatches.map((item) => item.id),
        [acceptedLudo.id, acceptedFc.id],
      );
      assert.ok(fixtureMatches.every((item) => item.status === "ACCEPTED"));
      assert.equal(fixtureMatches.some((item) => item.id === inactiveAccepted.id), false);
      assert.deepEqual(
        fixtureMatches.map((item) => item.game.slug),
        [ludo.slug, fc.slug],
      );
      assert.equal(fixtureMatches[0]?.challenger.presentation.photoUrl, ludoA.photoUrl);
      assert.equal(fixtureMatches[0]?.challenged.presentation.photoUrl, ludoB.photoUrl);
      assert.equal("userId" in (fixtureMatches[0]?.challenger ?? {}), false);
      assert.equal("gameId" in (fixtureMatches[0] ?? {}), false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await cleanup();
    }
  },
);
