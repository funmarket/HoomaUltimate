import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for Athletes Calendar integration tests");

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
  return { cookie, userId: credential.userId, username };
}

function headers(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function calendarUrl(base: string, communityId: string) {
  const from = encodeURIComponent("2026-09-01T00:00:00.000Z");
  const to = encodeURIComponent("2026-10-01T00:00:00.000Z");
  return `${base}/api/v1/athletes/${communityId}/calendar?from=${from}&to=${to}`;
}

test("Athletes private Calendar enforces membership, Founder mutation and community isolation", async () => {
  const app = createApp(config, createContainer(config));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);
  const communityIds: string[] = [];
  const userIds: string[] = [];

  try {
    const founder = await register(base, `cal_founder_${suffix}`);
    const member = await register(base, `cal_member_${suffix}`);
    const outsider = await register(base, `cal_outsider_${suffix}`);
    userIds.push(founder.userId, member.userId, outsider.userId);

    const createCommunity = async (name: string) => {
      const response = await fetch(`${base}/api/v1/athletes`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({
          name,
          sport: "RUNNING",
          visibility: "PRIVATE",
          joinPolicy: "APPROVAL_REQUIRED",
        }),
      });
      assert.equal(response.status, 201);
      const created = (await response.json()) as { id: string };
      communityIds.push(created.id);
      return created.id;
    };

    const firstId = await createCommunity(`Calendar One ${suffix}`);
    const secondId = await createCommunity(`Calendar Two ${suffix}`);

    const addMember = await fetch(`${base}/api/v1/athletes/${firstId}/members`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ username: member.username }),
    });
    assert.equal(addMember.status, 201);

    const outsiderList = await fetch(calendarUrl(base, firstId), {
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderList.status, 403);

    const memberList = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(memberList.status, 200);
    assert.deepEqual(await memberList.json(), []);

    const memberCreate = await fetch(`${base}/api/v1/athletes/${firstId}/calendar`, {
      method: "POST",
      headers: headers(member.cookie),
      body: JSON.stringify({
        title: "Forbidden",
        startsAt: "2026-09-20T17:00:00.000Z",
        endsAt: "2026-09-20T18:00:00.000Z",
        timezone: "Europe/Paris",
      }),
    });
    assert.equal(memberCreate.status, 403);

    const createdResponse = await fetch(`${base}/api/v1/athletes/${firstId}/calendar`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        title: "Evening run",
        description: "Easy pace",
        location: "Park entrance",
        startsAt: "2026-09-20T17:00:00.000Z",
        endsAt: "2026-09-20T18:00:00.000Z",
        timezone: "Europe/Paris",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as Record<string, unknown> & { id: string };
    assert.equal(created.title, "Evening run");
    assert.equal(created.timezone, "Europe/Paris");
    assert.equal("createdByUserId" in created, false);

    const memberRead = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(memberRead.status, 200);
    const entries = (await memberRead.json()) as Array<Record<string, unknown>>;
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.id, created.id);
    assert.equal("createdByUserId" in entries[0]!, false);

    const crossCommunityUpdate = await fetch(
      `${base}/api/v1/athletes/${secondId}/calendar/${created.id}`,
      {
        method: "PATCH",
        headers: headers(founder.cookie),
        body: JSON.stringify({ title: "Cross-scope" }),
      },
    );
    assert.equal(crossCommunityUpdate.status, 404);

    const update = await fetch(`${base}/api/v1/athletes/${firstId}/calendar/${created.id}`, {
      method: "PATCH",
      headers: headers(founder.cookie),
      body: JSON.stringify({ title: "Evening run updated" }),
    });
    assert.equal(update.status, 200);
    assert.equal(((await update.json()) as { title: string }).title, "Evening run updated");

    const cancel = await fetch(`${base}/api/v1/athletes/${firstId}/calendar/${created.id}/cancel`, {
      method: "POST",
      headers: headers(founder.cookie),
    });
    assert.equal(cancel.status, 200);
    const cancelled = (await cancel.json()) as { cancelledAt: string | null };
    assert.ok(cancelled.cancelledAt);

    const editCancelled = await fetch(`${base}/api/v1/athletes/${firstId}/calendar/${created.id}`, {
      method: "PATCH",
      headers: headers(founder.cookie),
      body: JSON.stringify({ title: "Must stay cancelled" }),
    });
    assert.equal(editCancelled.status, 409);

    const repeatCancel = await fetch(
      `${base}/api/v1/athletes/${firstId}/calendar/${created.id}/cancel`,
      { method: "POST", headers: headers(founder.cookie) },
    );
    assert.equal(repeatCancel.status, 200);
    assert.equal(
      ((await repeatCancel.json()) as { cancelledAt: string | null }).cancelledAt,
      cancelled.cancelledAt,
    );
  } finally {
    await db.athletesCommunity.deleteMany({ where: { id: { in: communityIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    server.close();
  }
});
