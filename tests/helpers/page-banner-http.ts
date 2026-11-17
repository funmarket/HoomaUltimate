import assert from "node:assert/strict";
import sharp from "sharp";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { createApp } from "../../apps/api/src/bootstrap/app.js";
import { createContainer } from "../../apps/api/src/bootstrap/container.js";

// Real HTTP/auth/application/repository/PostgreSQL; only the object store is local memory.
export async function pageBannerHttpFixture() {
  assert.equal(process.env.NODE_ENV, "test");
  assert(
    ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname),
    "Disposable local database required",
  );
  const objects = new Map<string, StoredObject>();
  const reads: string[] = [];
  const fixtureMediaIds = new Set<string>();
  const storage: ObjectStorage = {
    async put(key, body, contentType) {
      const value = { key, body: new Uint8Array(body), contentType, sizeBytes: body.byteLength };
      objects.set(key, value);
      return value;
    },
    async get(key) {
      reads.push(key);
      const value = objects.get(key);
      assert(value, "Expected stored fixture object");
      return value;
    },
    async remove(key) {
      objects.delete(key);
    },
  };
  const telegramId = BigInt(`8${Date.now()}${Math.floor(Math.random() * 1000)}`);
  const config = loadApiConfig({
    ...process.env,
    NODE_ENV: "test",
    WEB_ORIGIN: "http://localhost:5173",
    TELEGRAM_ORIGIN: "http://localhost:5174",
    TELEGRAM_BOT_TOKEN: "integration-test-token",
    MEDIA_STORAGE_SCOPE: "development",
    PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: telegramId.toString(),
  });
  const db = getDatabaseClient();
  const container = createContainer(config, { objectStorage: storage });
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const username = `bannercache_${Date.now()}`;
  const registered = await fetch(`${origin}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: username,
      displayUsername: username,
      displayName: username,
      password: "correct horse battery staple",
    }),
  });
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get("set-cookie")!.split(";")[0]!;
  const user = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: username } });
  const nonAdminUsername = `${username}_member`;
  const nonAdminRegistration = await fetch(`${origin}/api/public/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
    body: JSON.stringify({
      loginUsername: nonAdminUsername,
      displayUsername: nonAdminUsername,
      displayName: nonAdminUsername,
      password: "correct horse battery staple",
    }),
  });
  assert.equal(nonAdminRegistration.status, 201);
  const nonAdminCookie = nonAdminRegistration.headers.get("set-cookie")!.split(";")[0]!;
  const nonAdminUser = await db.webCredential.findUniqueOrThrow({
    where: { loginUsername: nonAdminUsername },
  });
  await db.telegramIdentity.create({ data: { userId: user.userId, telegramUserId: telegramId } });
  await container.platformAdminService.bootstrapConfiguredOwner(telegramId.toString());
  const prior = await db.pageBannerPlacement.findUniqueOrThrow({
    where: { id: "HOME_TOP" },
    include: { slides: true },
  });
  assert.equal(prior.slides.length, 0, "Isolated banner fixture must start empty");
  const headers = { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
  async function upload(color: string, slideId?: string) {
    const image = await sharp({
      create: { width: 1440, height: 600, channels: 3, background: color },
    })
      .png()
      .toBuffer();
    const path = slideId
      ? `/api/v1/admin/banners/HOME_TOP/slides/${slideId}/upload`
      : "/api/v1/admin/banners/HOME_TOP/slides/upload";
    const response = await fetch(
      `${origin}${path}?enabled=true&isDecorative=false&altText=Cache+test+banner`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "image/png" },
        body: new Uint8Array(image),
      },
    );
    assert.equal(response.status, slideId ? 200 : 201, await response.clone().text());
    if (!slideId) await enabled(true);
    const uploaded = await response.json();
    fixtureMediaIds.add(uploaded.mediaId);
    return uploaded;
  }
  async function enabled(value: boolean) {
    const response = await fetch(`${origin}/api/v1/admin/banners/HOME_TOP`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: value }),
    });
    assert.equal(response.status, 200);
  }
  async function requestDelete(slideId: string, body: unknown, requestHeaders = headers) {
    return fetch(`${origin}/api/v1/admin/banners/HOME_TOP/slides/${slideId}`, {
      method: "DELETE",
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function remove(slideId: string, reason = "Fixture cleanup") {
    const response = await requestDelete(slideId, { reason });
    assert.equal(response.status, 200);
  }
  async function metadata() {
    const response = await fetch(`${origin}/api/public/v1/banners/HOME_TOP`, {
      headers: { "X-Hooma-PageBanner-Delivery": "immutable" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response.json();
  }
  return {
    app,
    origin,
    db,
    storage,
    objects,
    reads,
    headers,
    nonAdminHeaders: {
      cookie: nonAdminCookie,
      origin: config.WEB_ORIGIN,
      "content-type": "application/json",
    },
    upload,
    enabled,
    requestDelete,
    remove,
    metadata,
    async close() {
      await db.pageBannerSlide.deleteMany({ where: { placementId: "HOME_TOP" } });
      await db.pageBannerPlacement.update({
        where: { id: "HOME_TOP" },
        data: { enabled: prior.enabled },
      });
      const mediaIds = [...fixtureMediaIds];
      await db.outboxEvent.deleteMany({
        where: {
          id: {
            in: mediaIds.flatMap((mediaId) => [mediaId, `page-banner-cleanup:${mediaId}`]),
          },
        },
      });
      await db.auditLog.deleteMany({
        where: { actorUserId: { in: [user.userId, nonAdminUser.userId] } },
      });
      await db.user.delete({ where: { id: nonAdminUser.userId } });
      await db.user.delete({ where: { id: user.userId } });
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await container.redis.close();
      await db.$disconnect();
    },
  };
}
