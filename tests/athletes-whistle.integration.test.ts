import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { Prisma, getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for Athletes Whistle integration tests");
if (!redisUrl) throw new Error("REDIS_URL is required for Athletes Whistle integration tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

function encodeRedis(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

async function redisCommand(parts: readonly string[]): Promise<string | number | null> {
  const url = new URL(redisUrl!);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    let buffer = Buffer.alloc(0);
    socket.once("error", reject);
    socket.once("connect", () => socket.write(encodeRedis(parts)));
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const prefix = String.fromCharCode(buffer[0] ?? 0);
      const lineEnd = buffer.indexOf("\r\n");
      if (lineEnd < 0) return;
      const line = buffer.subarray(1, lineEnd).toString("utf8");
      if (prefix === "+") {
        socket.end();
        resolve(line);
        return;
      }
      if (prefix === ":") {
        socket.end();
        resolve(Number(line));
        return;
      }
      if (prefix === "-") {
        socket.destroy();
        reject(new Error(line));
        return;
      }
      if (prefix === "$") {
        const length = Number(line);
        if (length === -1) {
          socket.end();
          resolve(null);
          return;
        }
        const start = lineEnd + 2;
        if (buffer.length < start + length + 2) return;
        socket.end();
        resolve(buffer.subarray(start, start + length).toString("utf8"));
      }
    });
  });
}

async function resetTestData() {
  await db.$executeRaw(Prisma.sql`DELETE FROM "WhistleMetadata"`);
  await db.athletesJoinRequest.deleteMany();
  await db.athletesMembership.deleteMany();
  await db.athletesCommunity.deleteMany();
  await db.communityJoinRequest.deleteMany();
  await db.communityMembership.deleteMany();
  await db.community.deleteMany();
  await db.webSession.deleteMany();
  await db.webCredential.deleteMany();
  await db.telegramIdentity.deleteMany();
  await db.platformRoleAssignment.deleteMany();
  await db.outboxEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.userPresentation.deleteMany();
  await db.user.deleteMany();
  await redisCommand(["FLUSHDB"]);
}

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

function whistlePath(contextId: string) {
  return `/api/v1/whistles/contexts/ATHLETES/${encodeURIComponent(contextId)}`;
}

function communityWhistlePath(contextId: string) {
  return `/api/v1/whistles/contexts/COMMUNITY/${encodeURIComponent(contextId)}`;
}

function postWhistle(base: string, cookie: string, contextId: string, body: string) {
  return fetch(`${base}${whistlePath(contextId)}`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ body }),
  });
}

async function createAthletes(base: string, cookie: string, name: string) {
  const response = await fetch(`${base}/api/v1/athletes`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({
      name,
      sport: "RUNNING",
      visibility: "PRIVATE",
      joinPolicy: "APPROVAL_REQUIRED",
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string };
}

async function addAthletesMember(
  base: string,
  founderCookie: string,
  athletesCommunityId: string,
  username: string,
) {
  const response = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/members`, {
    method: "POST",
    headers: headers(founderCookie),
    body: JSON.stringify({ username }),
  });
  assert.equal(response.status, 201);
}

test("Athletes Whistle is a private active-member board on the shared transient Whistle engine", async () => {
  await resetTestData();
  const container = createContainer(config);
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);

  try {
    const founder = await register(base, `ath_whistle_founder_${suffix}`);
    const member = await register(base, `ath_whistle_member_${suffix}`);
    const left = await register(base, `ath_whistle_left_${suffix}`);
    const wrongCommunity = await register(base, `ath_whistle_wrong_${suffix}`);
    const moderator = await register(base, `ath_whistle_mod_${suffix}`);
    const outsider = await register(base, `ath_whistle_outsider_${suffix}`);

    const athletes = await createAthletes(
      base,
      founder.cookie,
      `Carthage Whistle Runners ${suffix}`,
    );
    const otherAthletes = await createAthletes(
      base,
      founder.cookie,
      `Wrong Whistle Runners ${suffix}`,
    );
    await addAthletesMember(base, founder.cookie, athletes.id, member.username);
    await addAthletesMember(base, founder.cookie, athletes.id, left.username);
    await addAthletesMember(base, founder.cookie, athletes.id, moderator.username);
    await addAthletesMember(base, founder.cookie, otherAthletes.id, wrongCommunity.username);

    const promoteModerator = await fetch(
      `${base}/api/v1/athletes/${athletes.id}/members/${moderator.userId}/role`,
      {
        method: "PATCH",
        headers: headers(founder.cookie),
        body: JSON.stringify({ role: "MODERATOR" }),
      },
    );
    assert.equal(promoteModerator.status, 200);
    await db.athletesMembership.updateMany({
      where: { athletesCommunityId: athletes.id, userId: left.userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    assert.equal((await fetch(`${base}${whistlePath(athletes.id)}`)).status, 401);
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(outsider.cookie) }))
        .status,
      403,
    );
    assert.equal((await postWhistle(base, outsider.cookie, athletes.id, "outsider")).status, 403);
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(left.cookie) })).status,
      403,
    );
    assert.equal((await postWhistle(base, left.cookie, athletes.id, "left")).status, 403);
    assert.equal(
      (
        await fetch(`${base}${whistlePath(athletes.id)}`, {
          headers: headers(wrongCommunity.cookie),
        })
      ).status,
      403,
    );
    assert.equal(
      (await postWhistle(base, wrongCommunity.cookie, athletes.id, "wrong board")).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(founder.cookie) }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(moderator.cookie) }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(member.cookie) }))
        .status,
      200,
    );

    const exactLimit = await postWhistle(base, member.cookie, athletes.id, "👨‍👩‍👧‍👦".repeat(33));
    assert.equal(exactLimit.status, 201);
    const overLimit = await postWhistle(base, member.cookie, athletes.id, "👨‍👩‍👧‍👦".repeat(34));
    assert.equal(overLimit.status, 400);

    const durableSecret = `athletes-secret-body-${suffix}`;
    const sent = await postWhistle(base, founder.cookie, athletes.id, durableSecret);
    assert.equal(sent.status, 201);
    const sentPayload = (await sent.json()) as {
      whistle: { id: string; body: string; createdAt: string; expiresAt: string };
      remainingToday: number;
      resetsAt: string;
    };
    assert.equal(sentPayload.whistle.body, durableSecret);
    assert.equal(sentPayload.remainingToday, 10);
    assert.equal(
      await redisCommand(["GET", `whistle:body:${sentPayload.whistle.id}`]),
      durableSecret,
    );

    const memberList = await fetch(`${base}${whistlePath(athletes.id)}`, {
      headers: headers(member.cookie),
    });
    assert.equal(memberList.status, 200);
    const memberPayload = (await memberList.json()) as {
      items: Array<{ id: string; body: string }>;
    };
    assert.equal(
      memberPayload.items.find((item) => item.id === sentPayload.whistle.id)?.body,
      durableSecret,
    );

    const metadata = await db.$queryRaw<
      Array<{ contextType: string; contextId: string; json: string }>
    >(Prisma.sql`
      SELECT "contextType"::text AS "contextType", "contextId", to_jsonb(w)::text AS json
      FROM "WhistleMetadata" w
      WHERE w."id" = ${sentPayload.whistle.id}
    `);
    assert.equal(metadata[0]?.contextType, "ATHLETES");
    assert.equal(metadata[0]?.contextId, athletes.id);
    assert.equal(metadata[0]?.json.includes(durableSecret), false);
    assert.equal(
      Object.hasOwn(
        await db.whistleMetadata.findUniqueOrThrow({ where: { id: sentPayload.whistle.id } }),
        "body",
      ),
      false,
    );
    const outboxLeak = await db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "OutboxEvent" WHERE "payload"::text LIKE ${`%${durableSecret}%`}
    `);
    assert.equal(Number(outboxLeak[0]?.count ?? 0n), 0);
    const auditLeak = await db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "AuditLog" WHERE "metadata"::text LIKE ${`%${durableSecret}%`}
    `);
    assert.equal(Number(auditLeak[0]?.count ?? 0n), 0);

    const missingTarget = await postWhistle(
      base,
      member.cookie,
      "missing-athletes-community",
      "no target",
    );
    assert.equal(missingTarget.status, 403);

    const communityResponse = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ name: `Athletes quota HOOMA ${suffix}` }),
    });
    assert.equal(communityResponse.status, 201);
    const community = (await communityResponse.json()) as { id: string };
    for (let index = 0; index < 9; index += 1) {
      const response = await fetch(`${base}${communityWhistlePath(community.id)}`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({ body: `shared-quota-${index}` }),
      });
      assert.equal(response.status, 201);
    }
    const eleventhTotal = await postWhistle(base, founder.cookie, athletes.id, "eleventh total");
    assert.equal(eleventhTotal.status, 201);
    const twelfthTotal = await postWhistle(base, founder.cookie, athletes.id, "twelfth denied");
    assert.equal(twelfthTotal.status, 429);

    const expiredId = `expired-athletes-whistle-${suffix}`;
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "WhistleMetadata" ("id", "authorUserId", "contextType", "contextId", "createdAt", "expiresAt")
      VALUES (${expiredId}, ${member.userId}, CAST('ATHLETES' AS "WhistleContextType"), ${athletes.id}, ${new Date(Date.now() - 86_400_000)}, ${new Date(Date.now() - 1_000)})
    `);
    assert.equal(
      (await fetch(`${base}${whistlePath(athletes.id)}`, { headers: headers(member.cookie) }))
        .status,
      200,
    );
    assert.equal(await db.whistleMetadata.count({ where: { id: expiredId } }), 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    await resetTestData();
  }
});
