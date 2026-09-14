import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Calendar RSVP concurrency tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), 1500);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForSharedLockWait(): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const rows = await db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%AthletesCommunity%FOR SHARE%'
    `;
    if (Number(rows[0]?.count) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("RSVP request did not wait for the shared lifecycle guard");
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

function rsvpUrl(base: string, communityId: string, entryId: string) {
  return `${base}/api/v1/athletes/${communityId}/calendar/${entryId}/rsvp`;
}

test("Athletes Calendar RSVP uses shared lifecycle locking safely", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);
  const userIds: string[] = [];
  let communityId: string | null = null;

  try {
    const founder = await register(base, `rsvp_founder_${suffix}`);
    const memberA = await register(base, `rsvp_a_${suffix}`);
    const memberB = await register(base, `rsvp_b_${suffix}`);
    const memberC = await register(base, `rsvp_c_${suffix}`);
    userIds.push(founder.userId, memberA.userId, memberB.userId, memberC.userId);

    const communityResponse = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `RSVP Concurrency ${suffix}`,
        sport: "RUNNING",
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
      }),
    });
    assert.equal(communityResponse.status, 201);
    communityId = ((await communityResponse.json()) as { id: string }).id;

    for (const member of [memberA, memberB, memberC]) {
      const added = await fetch(`${base}/api/v1/athletes/${communityId}/members`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({ username: member.username }),
      });
      assert.equal(added.status, 201);
    }

    const createEntry = async (title: string) => {
      const response = await fetch(`${base}/api/v1/athletes/${communityId}/calendar`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({
          title,
          startsAt: "2026-09-20T17:00:00.000Z",
          endsAt: "2026-09-20T18:00:00.000Z",
          timezone: "UTC",
        }),
      });
      assert.equal(response.status, 201);
      return ((await response.json()) as { id: string }).id;
    };

    const parallelEntry = await createEntry("Parallel RSVP");
    const shareHeld = deferred();
    const releaseShare = deferred();
    const shareTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "AthletesCommunity"
        WHERE id = ${communityId}
        FOR SHARE
      `;
      shareHeld.resolve();
      await releaseShare.promise;
    });
    await shareHeld.promise;

    const parallelRsvp = fetch(rsvpUrl(base, communityId, parallelEntry), {
      method: "PUT",
      headers: headers(memberA.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    try {
      const response = await withTimeout(
        parallelRsvp,
        "RSVP was blocked by a compatible shared lifecycle lock",
      );
      assert.equal(response.status, 200);
    } finally {
      releaseShare.resolve();
      await shareTransaction;
    }

    const sameUserEntry = await createEntry("Same user RSVP");
    const sameUserUrl = rsvpUrl(base, communityId, sameUserEntry);
    const sameUserResponses = await Promise.all([
      fetch(sameUserUrl, {
        method: "PUT",
        headers: headers(memberB.cookie),
        body: JSON.stringify({ status: "GOING" }),
      }),
      fetch(sameUserUrl, {
        method: "PUT",
        headers: headers(memberB.cookie),
        body: JSON.stringify({ status: "MAYBE" }),
      }),
    ]);
    assert.equal(sameUserResponses[0]!.status, 200);
    assert.equal(sameUserResponses[1]!.status, 200);
    const sameUserCount = await db.athletesCalendarRsvp.count({
      where: { calendarEntryId: sameUserEntry, userId: memberB.userId },
    });
    assert.equal(sameUserCount, 1);

    const removalEntry = await createEntry("Removal race");
    const removalChanged = deferred();
    const releaseRemoval = deferred();
    const removalTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "AthletesCommunity"
        WHERE id = ${communityId}
        FOR UPDATE
      `;
      await tx.$executeRaw`
        UPDATE "AthletesMembership"
        SET "leftAt" = NOW()
        WHERE "athletesCommunityId" = ${communityId}
          AND "userId" = ${memberC.userId}
          AND "leftAt" IS NULL
      `;
      removalChanged.resolve();
      await releaseRemoval.promise;
    });
    await removalChanged.promise;

    const removalRsvp = fetch(rsvpUrl(base, communityId, removalEntry), {
      method: "PUT",
      headers: headers(memberC.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    void removalRsvp.catch(() => undefined);
    try {
      await waitForSharedLockWait();
    } finally {
      releaseRemoval.resolve();
      await removalTransaction;
    }
    assert.equal((await removalRsvp).status, 403);

    const cancellationEntry = await createEntry("Cancellation race");
    const cancellationChanged = deferred();
    const releaseCancellation = deferred();
    const cancellationTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "AthletesCommunity"
        WHERE id = ${communityId}
        FOR UPDATE
      `;
      await tx.athletesCalendarEntry.update({
        where: { id: cancellationEntry },
        data: { cancelledAt: new Date() },
      });
      cancellationChanged.resolve();
      await releaseCancellation.promise;
    });
    await cancellationChanged.promise;

    const cancellationRsvp = fetch(rsvpUrl(base, communityId, cancellationEntry), {
      method: "PUT",
      headers: headers(memberA.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    void cancellationRsvp.catch(() => undefined);
    try {
      await waitForSharedLockWait();
    } finally {
      releaseCancellation.resolve();
      await cancellationTransaction;
    }
    assert.equal((await cancellationRsvp).status, 409);

    const archiveEntry = await createEntry("Archive race");
    const archiveChanged = deferred();
    const releaseArchive = deferred();
    const archiveTransaction = db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "AthletesCommunity"
        WHERE id = ${communityId}
        FOR UPDATE
      `;
      await tx.athletesCommunity.update({
        where: { id: communityId },
        data: { status: "ARCHIVED" },
      });
      archiveChanged.resolve();
      await releaseArchive.promise;
    });
    await archiveChanged.promise;

    const archiveRsvp = fetch(rsvpUrl(base, communityId, archiveEntry), {
      method: "PUT",
      headers: headers(memberB.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    void archiveRsvp.catch(() => undefined);
    try {
      await waitForSharedLockWait();
    } finally {
      releaseArchive.resolve();
      await archiveTransaction;
    }
    assert.equal((await archiveRsvp).status, 403);
  } finally {
    if (communityId) await db.athletesCommunity.deleteMany({ where: { id: communityId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    server.close();
    await db.$disconnect();
  }
});
