import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage, StoredObject, StoredObjectDescriptor } from "@hooma/storage";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Athletes Photo HTTP tests");

const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
});
const db = getDatabaseClient();

class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor> {
    const stored: StoredObject = {
      key,
      body: new Uint8Array(body),
      contentType,
      sizeBytes: body.byteLength,
    };
    this.objects.set(key, stored);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<StoredObject> {
    const stored = this.objects.get(key);
    if (!stored) throw new Error("object not found");
    return stored;
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key);
  }
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

function jsonHeaders(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function imageHeaders(cookie: string, contentType: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": contentType };
}

test("Athletes Photo Board HTTP routes keep upload Founder-only and content member-private", async () => {
  const storage = new MemoryObjectStorage();
  const container = createContainer(config, { objectStorage: storage });
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const suffix = Date.now().toString(36);
  const createdUserIds: string[] = [];
  let athletesCommunityId: string | null = null;

  try {
    const founder = await register(base, `ath_photo_founder_${suffix}`);
    const member = await register(base, `ath_photo_member_${suffix}`);
    const outsider = await register(base, `ath_photo_outsider_${suffix}`);
    createdUserIds.push(founder.userId, member.userId, outsider.userId);

    const createdResponse = await fetch(`${base}/api/v1/athletes`, {
      method: "POST",
      headers: jsonHeaders(founder.cookie),
      body: JSON.stringify({
        name: `Founder Photo Board ${suffix}`,
        sport: "RUNNING",
        city: "Tunis",
        houma: "Carthage",
        visibility: "PRIVATE",
        joinPolicy: "APPROVAL_REQUIRED",
      }),
    });
    assert.equal(createdResponse.status, 201);
    athletesCommunityId = ((await createdResponse.json()) as { id: string }).id;

    const addMember = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/members`, {
      method: "POST",
      headers: jsonHeaders(founder.cookie),
      body: JSON.stringify({ username: member.username }),
    });
    assert.equal(addMember.status, 201);

    const unauthenticatedUpload = await fetch(
      `${base}/api/v1/athletes/${athletesCommunityId}/photos`,
      {
        method: "POST",
        headers: { origin: config.WEB_ORIGIN, "content-type": "image/png" },
        body: Uint8Array.of(1, 2, 3),
      },
    );
    assert.equal(unauthenticatedUpload.status, 401);

    const memberUpload = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/photos`, {
      method: "POST",
      headers: imageHeaders(member.cookie, "image/png"),
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(memberUpload.status, 403);
    assert.equal(storage.objects.size, 0);

    const invalidType = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/photos`, {
      method: "POST",
      headers: imageHeaders(founder.cookie, "text/plain"),
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(invalidType.status, 415);
    assert.equal(
      ((await invalidType.json()) as { error: { code: string } }).error.code,
      "ATHLETES_PHOTO_TYPE_INVALID",
    );

    const uploadBytes = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
    const upload = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/photos`, {
      method: "POST",
      headers: imageHeaders(founder.cookie, "image/png"),
      body: uploadBytes,
    });
    assert.equal(upload.status, 201);
    const uploaded = (await upload.json()) as {
      id: string;
      athletesCommunityId: string;
      contentType: string;
      sizeBytes: number;
      createdAt: string;
      updatedAt: string;
      objectKey?: unknown;
      uploadedByUserId?: unknown;
    };
    assert.equal(uploaded.athletesCommunityId, athletesCommunityId);
    assert.equal(uploaded.contentType, "image/png");
    assert.equal(uploaded.sizeBytes, uploadBytes.byteLength);
    assert.equal(uploaded.objectKey, undefined);
    assert.equal(uploaded.uploadedByUserId, undefined);
    assert.ok(uploaded.createdAt);
    assert.ok(uploaded.updatedAt);

    const persisted = await db.athletesPhoto.findUniqueOrThrow({ where: { id: uploaded.id } });
    assert.equal(persisted.athletesCommunityId, athletesCommunityId);
    assert.equal(persisted.uploadedByUserId, founder.userId);
    assert.ok(storage.objects.has(persisted.objectKey));

    const memberList = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/photos`, {
      headers: jsonHeaders(member.cookie),
    });
    assert.equal(memberList.status, 200);
    const listed = (await memberList.json()) as Array<Record<string, unknown>>;
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, uploaded.id);
    assert.equal("objectKey" in (listed[0] ?? {}), false);
    assert.equal("uploadedByUserId" in (listed[0] ?? {}), false);

    const outsiderList = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}/photos`, {
      headers: jsonHeaders(outsider.cookie),
    });
    assert.equal(outsiderList.status, 403);

    const memberContent = await fetch(
      `${base}/api/v1/athletes/${athletesCommunityId}/photos/${uploaded.id}/content`,
      { headers: jsonHeaders(member.cookie) },
    );
    assert.equal(memberContent.status, 200);
    assert.equal(memberContent.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await memberContent.arrayBuffer()), uploadBytes);

    const outsiderContent = await fetch(
      `${base}/api/v1/athletes/${athletesCommunityId}/photos/${uploaded.id}/content`,
      { headers: jsonHeaders(outsider.cookie) },
    );
    assert.equal(outsiderContent.status, 403);

    const missingContent = await fetch(
      `${base}/api/v1/athletes/${athletesCommunityId}/photos/missing-photo/content`,
      { headers: jsonHeaders(member.cookie) },
    );
    assert.equal(missingContent.status, 404);
    assert.equal(
      ((await missingContent.json()) as { error: { code: string } }).error.code,
      "ATHLETES_PHOTO_NOT_FOUND",
    );

    const jsonRouteStillWorks = await fetch(`${base}/api/v1/athletes/${athletesCommunityId}`, {
      headers: jsonHeaders(founder.cookie),
    });
    assert.equal(jsonRouteStillWorks.status, 200);
    assert.equal(
      ((await jsonRouteStillWorks.json()) as { viewerRole: string }).viewerRole,
      "FOUNDER",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    if (athletesCommunityId) {
      await db.athletesPhoto.deleteMany({ where: { athletesCommunityId } });
      await db.athletesJoinRequest.deleteMany({ where: { athletesCommunityId } });
      await db.athletesMembership.deleteMany({ where: { athletesCommunityId } });
      await db.athletesCommunity.deleteMany({ where: { id: athletesCommunityId } });
    }
    if (createdUserIds.length > 0) {
      await db.webSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.webCredential.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.telegramIdentity.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.userPresentation.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }
});
