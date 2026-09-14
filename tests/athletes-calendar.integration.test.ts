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

function rsvpUrl(base: string, communityId: string, entryId: string) {
  return `${base}/api/v1/athletes/${communityId}/calendar/${entryId}/rsvp`;
}

test("Athletes private Calendar enforces membership, Founder mutation, RSVP ownership and community isolation", async () => {
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
    const former = await register(base, `cal_former_${suffix}`);
    const outsider = await register(base, `cal_outsider_${suffix}`);
    userIds.push(founder.userId, member.userId, former.userId, outsider.userId);

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

    for (const username of [member.username, former.username]) {
      const addMember = await fetch(`${base}/api/v1/athletes/${firstId}/members`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({ username }),
      });
      assert.equal(addMember.status, 201);
    }

    const outsiderList = await fetch(calendarUrl(base, firstId), {
      headers: headers(outsider.cookie),
    });
    assert.equal(outsiderList.status, 403);

    const memberList = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(memberList.status, 200);
    assert.deepEqual(await memberList.json(), { items: [], nextCursor: null });

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

    const outsiderRsvp = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(outsider.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    assert.equal(outsiderRsvp.status, 403);

    const memberRead = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(memberRead.status, 200);
    let page = (await memberRead.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };
    let entries = page.items;
    assert.equal(entries.length, 1);
    assert.equal(page.nextCursor, null);
    assert.equal(entries[0]!.id, created.id);
    assert.equal("createdByUserId" in entries[0]!, false);
    assert.deepEqual(entries[0]!.rsvp, {
      viewerStatus: null,
      counts: { going: 0, maybe: 0, notGoing: 0 },
    });

    const memberGoing = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    assert.equal(memberGoing.status, 200);
    assert.deepEqual(await memberGoing.json(), { entryId: created.id, status: "GOING" });

    const formerGoing = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(former.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    assert.equal(formerGoing.status, 200);

    const founderMaybe = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(founder.cookie),
      body: JSON.stringify({ status: "MAYBE" }),
    });
    assert.equal(founderMaybe.status, 200);

    const memberNotGoing = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "NOT_GOING" }),
    });
    assert.equal(memberNotGoing.status, 200);

    const persistedMemberRsvps = await db.athletesCalendarRsvp.count({
      where: { calendarEntryId: created.id, userId: member.userId },
    });
    assert.equal(persistedMemberRsvps, 1);

    const beforeFormerRemoval = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(beforeFormerRemoval.status, 200);
    page = (await beforeFormerRemoval.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };
    entries = page.items;
    assert.deepEqual(entries[0]!.rsvp, {
      viewerStatus: "NOT_GOING",
      counts: { going: 1, maybe: 1, notGoing: 1 },
    });

    const removeFormer = await fetch(
      `${base}/api/v1/athletes/${firstId}/members/${former.userId}`,
      { method: "DELETE", headers: headers(founder.cookie) },
    );
    assert.equal(removeFormer.status, 200);

    const persistedFormerRsvps = await db.athletesCalendarRsvp.count({
      where: { calendarEntryId: created.id, userId: former.userId },
    });
    assert.equal(persistedFormerRsvps, 1, "membership removal must retain RSVP history");

    const formerReadAfterRemoval = await fetch(calendarUrl(base, firstId), {
      headers: headers(former.cookie),
    });
    assert.equal(formerReadAfterRemoval.status, 403);

    const memberReadAfterRsvp = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(memberReadAfterRsvp.status, 200);
    page = (await memberReadAfterRsvp.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };
    entries = page.items;
    assert.deepEqual(entries[0]!.rsvp, {
      viewerStatus: "NOT_GOING",
      counts: { going: 0, maybe: 1, notGoing: 1 },
    });

    const invalidRsvp = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "INTERESTED" }),
    });
    assert.equal(invalidRsvp.status, 400);

    const crossCommunityRsvp = await fetch(rsvpUrl(base, secondId, created.id), {
      method: "PUT",
      headers: headers(founder.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    assert.equal(crossCommunityRsvp.status, 404);

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

    const cancelledRead = await fetch(calendarUrl(base, firstId), {
      headers: headers(member.cookie),
    });
    assert.equal(cancelledRead.status, 200);
    page = (await cancelledRead.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };
    entries = page.items;
    assert.deepEqual(entries[0]!.rsvp, {
      viewerStatus: "NOT_GOING",
      counts: { going: 0, maybe: 1, notGoing: 1 },
    });

    const rsvpCancelled = await fetch(rsvpUrl(base, firstId, created.id), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "MAYBE" }),
    });
    assert.equal(rsvpCancelled.status, 409);

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

test("Athletes Calendar pages tied rows and only aggregates returned entries", async () => {
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
    const founder = await register(base, `cal_page_founder_${suffix}`);
    const member = await register(base, `cal_page_member_${suffix}`);
    userIds.push(founder.userId, member.userId);

    const createCommunity = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({
        name: `Calendar Page ${suffix}`,
        sport: "RUNNING",
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
      }),
    });
    assert.equal(createCommunity.status, 201);
    const community = (await createCommunity.json()) as { id: string };
    communityIds.push(community.id);

    const addMember = await fetch(`${base}/api/v1/athletes/${community.id}/members`, {
      method: "POST",
      headers: headers(founder.cookie),
      body: JSON.stringify({ username: member.username }),
    });
    assert.equal(addMember.status, 201);

    const entryIds: string[] = [];
    for (const title of ["A tied row", "B tied row", "C later row"]) {
      const createEntry = await fetch(`${base}/api/v1/athletes/${community.id}/calendar`, {
        method: "POST",
        headers: headers(founder.cookie),
        body: JSON.stringify({
          title,
          startsAt: title.startsWith("C") ? "2026-09-20T19:00:00.000Z" : "2026-09-20T17:00:00.000Z",
          endsAt: title.startsWith("C") ? "2026-09-20T20:00:00.000Z" : "2026-09-20T18:00:00.000Z",
          timezone: "UTC",
        }),
      });
      assert.equal(createEntry.status, 201);
      entryIds.push(((await createEntry.json()) as { id: string }).id);
    }

    const firstRsvp = await fetch(rsvpUrl(base, community.id, entryIds[0]!), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "GOING" }),
    });
    assert.equal(firstRsvp.status, 200);
    const hiddenPageRsvp = await fetch(rsvpUrl(base, community.id, entryIds[2]!), {
      method: "PUT",
      headers: headers(member.cookie),
      body: JSON.stringify({ status: "NOT_GOING" }),
    });
    assert.equal(hiddenPageRsvp.status, 200);

    const from = encodeURIComponent("2026-09-20T00:00:00.000Z");
    const to = encodeURIComponent("2026-09-21T00:00:00.000Z");
    const firstResponse = await fetch(
      `${base}/api/v1/athletes/${community.id}/calendar?from=${from}&to=${to}&limit=2`,
      { headers: headers(member.cookie) },
    );
    assert.equal(firstResponse.status, 200);
    const first = (await firstResponse.json()) as {
      items: Array<{ id: string; rsvp: { counts: { going: number; notGoing: number } } }>;
      nextCursor: string | null;
    };
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    assert.deepEqual(first.items.map((entry) => entry.id).sort(), entryIds.slice(0, 2).sort());
    assert.equal(
      first.items.reduce((total, entry) => total + entry.rsvp.counts.notGoing, 0),
      0,
      "RSVP aggregates must be scoped to returned Calendar rows only",
    );

    const secondResponse = await fetch(
      `${base}/api/v1/athletes/${community.id}/calendar?from=${from}&to=${to}&limit=2&cursor=${encodeURIComponent(
        first.nextCursor,
      )}`,
      { headers: headers(member.cookie) },
    );
    assert.equal(secondResponse.status, 200);
    const second = (await secondResponse.json()) as {
      items: Array<{ id: string; rsvp: { counts: { notGoing: number } } }>;
      nextCursor: string | null;
    };
    assert.deepEqual(
      second.items.map((entry) => entry.id),
      [entryIds[2]],
    );
    assert.equal(second.items[0]?.rsvp.counts.notGoing, 1);
    assert.equal(second.nextCursor, null);
  } finally {
    await db.athletesCommunity.deleteMany({ where: { id: { in: communityIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    server.close();
  }
});
