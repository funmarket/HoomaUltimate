import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for athletes integration tests");

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
  return { cookie, userId: credential.userId };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

test("Athletes member and join-request cursors traverse tied rows without gaps", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const founder = await register(base, `page_founder_${suffix}`);
    const applicants = await Promise.all(
      [0, 1, 2].map((index) => register(base, `page_member_${index}_${suffix}`)),
    );

    const createdResponse = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `Pagination runners ${suffix}`,
        sport: "RUNNING",
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as { id: string };

    for (const applicant of applicants) {
      const join = await fetch(`${base}/api/v1/athletes/${created.id}/join`, {
        method: "POST",
        headers: headers(applicant.cookie),
      });
      assert.equal(join.status, 202);
    }

    const tiedAt = new Date("2026-09-14T12:00:00.000Z");
    await db.athletesJoinRequest.updateMany({
      where: { athletesCommunityId: created.id, status: "PENDING" },
      data: { requestedAt: tiedAt },
    });

    const firstRequestsResponse = await fetch(
      `${base}/api/v1/athletes/${created.id}/join-requests?limit=2`,
      { headers: headers(founder.cookie) },
    );
    assert.equal(firstRequestsResponse.status, 200);
    const firstRequests = (await firstRequestsResponse.json()) as {
      items: { id: string; userId: string }[];
      nextCursor: string | null;
    };
    assert.equal(firstRequests.items.length, 2);
    assert.ok(firstRequests.nextCursor);

    const secondRequestsResponse = await fetch(
      `${base}/api/v1/athletes/${created.id}/join-requests?limit=2&cursor=${encodeURIComponent(firstRequests.nextCursor)}`,
      { headers: headers(founder.cookie) },
    );
    assert.equal(secondRequestsResponse.status, 200);
    const secondRequests = (await secondRequestsResponse.json()) as {
      items: { id: string; userId: string }[];
      nextCursor: string | null;
    };
    assert.equal(secondRequests.items.length, 1);
    assert.equal(secondRequests.nextCursor, null);
    assert.equal(
      new Set([...firstRequests.items, ...secondRequests.items].map((item) => item.id)).size,
      3,
    );

    for (const applicant of applicants) {
      const approve = await fetch(
        `${base}/api/v1/athletes/${created.id}/join-requests/${applicant.userId}/approve`,
        { method: "POST", headers: headers(founder.cookie) },
      );
      assert.equal(approve.status, 200);
    }

    await db.athletesMembership.updateMany({
      where: { athletesCommunityId: created.id, role: "MEMBER", leftAt: null },
      data: { joinedAt: tiedAt },
    });

    const seenUserIds: string[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ limit: "2" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(
        `${base}/api/v1/athletes/${created.id}/members?${params.toString()}`,
        { headers: headers(founder.cookie) },
      );
      assert.equal(response.status, 200);
      const page = (await response.json()) as {
        items: { userId: string }[];
        nextCursor: string | null;
      };
      seenUserIds.push(...page.items.map((item) => item.userId));
      cursor = page.nextCursor;
    } while (cursor);

    assert.equal(seenUserIds.length, 4);
    assert.equal(new Set(seenUserIds).size, 4);
    assert.equal(seenUserIds.includes(founder.userId), true);
    for (const applicant of applicants) {
      assert.equal(seenUserIds.includes(applicant.userId), true);
    }
  } finally {
    server.close();
  }
});