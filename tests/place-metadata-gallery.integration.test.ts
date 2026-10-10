import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
import { PlaceService } from "../apps/api/src/modules/places/application/place.service.js";
import { PlaceMediaService } from "../apps/api/src/modules/places/application/place-media.service.js";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";
import { SharpPlaceImageProcessor } from "../apps/api/src/modules/places/infrastructure/sharp-place-image-processor.js";
import { PLACE_IMAGE_RECONCILE_TOPIC, type PlaceUpdateInput } from "@hooma/contracts/places";
import { createPlaceImageCleanupHandler } from "../apps/worker/src/places/place-image-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Place metadata tests");
const db = getDatabaseClient();
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const adminTelegramId = BigInt(`8${suffix}`);
const config = loadApiConfig({
  ...process.env,
  NODE_ENV: "test",
  MEDIA_STORAGE_SCOPE: "development",
  WEB_ORIGIN: "http://localhost:5173",
  TELEGRAM_ORIGIN: "http://localhost:5174",
  TELEGRAM_BOT_TOKEN: "integration-test-token",
  PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: adminTelegramId.toString(),
});

class TestStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  async put(key: string, body: Uint8Array, contentType: string) {
    this.objects.set(key, { key, body, contentType, sizeBytes: body.byteLength });
    return { key, contentType, sizeBytes: body.byteLength };
  }
  async get(key: string) {
    const value = this.objects.get(key);
    if (!value) throw new Error("missing test object");
    return value;
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
}

test("Place metadata and gallery operations retain separate ownership through HTTP and PostgreSQL", async (t) => {
  const storage = new TestStorage();
  const container = createContainer(config, { objectStorage: storage });
  container.apiRateLimiter.consume = async () => ({
    allowed: true,
    limit: 6000,
    remaining: 5999,
    retryAfterSeconds: 60,
  });
  const repository = new PrismaPlaceRepository(db);
  // External networking is isolated; production services, routes, auth and persistence remain real.
  const resolver = { resolve: async (value: string) => value };
  container.placeService = new PlaceService(repository, container.platformAdminService, resolver);
  container.placeMediaService = new PlaceMediaService(
    repository,
    container.platformAdminService,
    resolver,
    storage,
    new SharpPlaceImageProcessor(),
  );
  const server = createApp(config, container).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const users: string[] = [];
  const places: string[] = [];
  async function register(label: string) {
    const username = `${label}_${suffix}`;
    const response = await fetch(`${base}/api/public/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.WEB_ORIGIN },
      body: JSON.stringify({
        loginUsername: username,
        displayUsername: username,
        displayName: label,
        password: "correct horse battery staple",
      }),
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie");
    assert.ok(cookie);
    const user = await db.webCredential.findUniqueOrThrow({ where: { loginUsername: username } });
    users.push(user.userId);
    return { cookie, userId: user.userId };
  }
  function call(cookie: string, path: string, method = "GET", body?: unknown) {
    return fetch(`${base}/api/v1/places${path}`, {
      method,
      headers: { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function gallery(id: string) {
    return db.placeImage.findMany({ where: { placeId: id }, orderBy: { sortOrder: "asc" } });
  }
  try {
    const fan = await register("fan");
    const owner = await register("owner");
    const admin = await register("admin");
    await db.telegramIdentity.create({
      data: { userId: admin.userId, telegramUserId: adminTelegramId },
    });
    await container.platformAdminService.bootstrapConfiguredOwner(adminTelegramId.toString());
    const urls = [1, 2, 3, 4].map((n) => `https://images.example.test/${n}.jpg`);
    const suggestion = await call(fan.cookie, "", "POST", {
      name: `Gallery ${suffix}`,
      address: `Test road ${suffix}`,
      imageUrls: urls,
    });
    assert.equal(suggestion.status, 201);
    const id = (await suggestion.json()).place.id as string;
    places.push(id);
    const original = await gallery(id);
    await t.test("initial suggestion creates four URL images", () => {
      assert.equal(original.length, 4);
      assert.deepEqual(
        original.map((image) => image.imageUrl),
        urls,
      );
    });
    await t.test("metadata fields and menu edits preserve complete gallery rows", async () => {
      const response = await call(fan.cookie, `/${id}`, "PATCH", {
        name: `Renamed ${suffix}`,
        address: `Changed road ${suffix}`,
        city: "Test city",
        houma: "Test neighbourhood",
        latitude: 36.8,
        longitude: 10.1,
        phone: "123",
        websiteUrl: "https://example.test",
        description: "Updated",
        category: "Cafe",
        email: "venue@example.test",
        menuItems: [{ name: "Tea", price: 2, currency: "TND" }],
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.description, "Updated");
      assert.equal(result.menuItems[0].name, "Tea");
      assert.deepEqual(await gallery(id), original);
    });
    await t.test(
      "legacy image fields are rejected explicitly without clearing or recreating rows",
      async () => {
        for (const body of [
          { imageUrls: [] },
          { imageUrl: null },
          { imageUrls: [urls[3], urls[0]] },
          { imageUrl: urls[0] },
        ]) {
          const response = await call(fan.cookie, `/${id}`, "PATCH", body);
          assert.equal(response.status, 400);
          assert.deepEqual(await gallery(id), original);
        }
        await assert.rejects(() =>
          container.placeService.update(fan.userId, id, { imageUrls: [] } as PlaceUpdateInput),
        );
        assert.deepEqual(await gallery(id), original);
      },
    );
    await t.test(
      "direct repository metadata writes cannot mutate gallery even with stale extra fields",
      async () => {
        await repository.update(id, {
          description: "Repository metadata",
          imageUrls: [],
        } as PlaceUpdateInput);
        assert.deepEqual(await gallery(id), original);
        await repository.update(id, {
          description: "Stale metadata",
          imageUrl: urls[0],
          imageUrls: urls.slice().reverse(),
        } as PlaceUpdateInput);
        assert.deepEqual(await gallery(id), original);
      },
    );
    await t.test("generic pending FanHub management does not authorize media changes", async () => {
      assert.equal((await call(fan.cookie, `/${id}/manage`)).status, 200);
      for (const [path, method, body] of [
        [`/${id}/images/external`, "POST", { url: urls[0] }],
        [`/${id}/images/order`, "PUT", { imageIds: original.map((image) => image.id) }],
        [`/${id}/images/${original[0]!.id}`, "DELETE", undefined],
      ] as const) {
        assert.equal((await call(fan.cookie, path, method, body)).status, 403);
      }
      const managed = await (await call(fan.cookie, `/${id}/manage`)).json();
      assert.equal(managed.mediaImageLimit, null);
      assert.deepEqual(await gallery(id), original);
    });
    await t.test(
      "App Admin can extend to six and reorder without changing image identities",
      async () => {
        const managed = await (await call(admin.cookie, `/${id}/manage`)).json();
        assert.equal(managed.mediaImageLimit, 6);
        for (const n of [5, 6])
          assert.equal(
            (
              await call(admin.cookie, `/${id}/images/external`, "POST", {
                url: `https://images.example.test/${n}.jpg`,
              })
            ).status,
            201,
          );
        assert.equal(
          (await call(admin.cookie, `/${id}/images/external`, "POST", { url: urls[0] })).status,
          409,
        );
        const six = await gallery(id);
        assert.equal(
          (await call(admin.cookie, `/${id}`, "PATCH", { description: "Six-photo metadata" }))
            .status,
          200,
        );
        assert.deepEqual(await gallery(id), six);
        const reversed = six.map((image) => image.id).reverse();
        assert.equal(
          (await call(admin.cookie, `/${id}/images/order`, "PUT", { imageIds: reversed })).status,
          200,
        );
        const reordered = await gallery(id);
        assert.deepEqual(
          reordered.map((image) => image.id),
          reversed,
        );
        assert.deepEqual(
          new Set(reordered.map((image) => image.imageUrl)),
          new Set(six.map((image) => image.imageUrl)),
        );
      },
    );
    const ownerSuggestion = await call(owner.cookie, "", "POST", {
      name: `Owner ${suffix}`,
      address: `Owner road ${suffix}`,
      submissionOrigin: "OWNER",
      imageUrls: [],
    });
    assert.equal(ownerSuggestion.status, 201);
    const ownerId = (await ownerSuggestion.json()).place.id as string;
    places.push(ownerId);
    await t.test(
      "pending owner upload, external addition, deletion and three-image limit remain functional",
      async () => {
        assert.equal(
          (await (await call(owner.cookie, `/${ownerId}/manage`)).json()).mediaImageLimit,
          3,
        );
        const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
          .png()
          .toBuffer();
        const deniedUpload = await fetch(`${base}/api/v1/places/${id}/images/upload`, {
          method: "POST",
          headers: { cookie: fan.cookie, origin: config.WEB_ORIGIN, "content-type": "image/png" },
          body: png,
        });
        assert.equal(deniedUpload.status, 403);
        const uploaded = await fetch(`${base}/api/v1/places/${ownerId}/images/upload`, {
          method: "POST",
          headers: { cookie: owner.cookie, origin: config.WEB_ORIGIN, "content-type": "image/png" },
          body: png,
        });
        assert.equal(uploaded.status, 201);
        const image = await uploaded.json();
        assert.equal(image.imageUrl, `/api/public/v1/places/${ownerId}/images/${image.id}/content`);
        assert.equal(storage.objects.size, 1);
        const beforeSave = await gallery(ownerId);
        await call(owner.cookie, `/${ownerId}`, "PATCH", {
          description: "Managed photo preserved",
        });
        assert.deepEqual(await gallery(ownerId), beforeSave);
        assert.equal(storage.objects.size, 1);
        for (const n of [1, 2])
          assert.equal(
            (await call(owner.cookie, `/${ownerId}/images/external`, "POST", { url: urls[n] }))
              .status,
            201,
          );
        assert.equal(
          (await call(owner.cookie, `/${ownerId}/images/external`, "POST", { url: urls[0] }))
            .status,
          409,
        );
        assert.equal(
          (await call(owner.cookie, `/${ownerId}/images/${image.id}`, "DELETE")).status,
          200,
        );
        assert.equal((await gallery(ownerId)).length, 2);
        const cleanup = await db.outboxEvent.findUniqueOrThrow({ where: { id: image.id } });
        assert.equal(cleanup.topic, PLACE_IMAGE_RECONCILE_TOPIC);
        assert.equal(cleanup.status, "PENDING");
        assert.equal(storage.objects.size, 1);
        const runner = new OutboxRunner(
          new OutboxRepository(db),
          new Map([[PLACE_IMAGE_RECONCILE_TOPIC, createPlaceImageCleanupHandler(db, storage)]]),
        );
        assert.equal((await runner.runOnce()).delivered, 1);
        assert.equal(storage.objects.size, 0);
      },
    );
    await t.test(
      "verified ownership retains narrower media rights and public Place gallery projection",
      async () => {
        await db.place.update({ where: { id: ownerId }, data: { moderationStatus: "APPROVED" } });
        assert.equal(
          (await call(owner.cookie, `/${ownerId}/images/external`, "POST", { url: urls[0] }))
            .status,
          403,
        );
        await db.placeOwnership.create({
          data: { placeId: ownerId, userId: owner.userId, verifiedByUserId: admin.userId },
        });
        assert.equal(
          (await call(owner.cookie, `/${ownerId}/images/external`, "POST", { url: urls[0] }))
            .status,
          201,
        );
        const response = await fetch(`${base}/api/public/v1/places/${ownerId}`);
        assert.equal(response.status, 200);
        const publicPlace = await response.json();
        const rows = await gallery(ownerId);
        assert.deepEqual(
          publicPlace.images,
          rows.map(({ id, imageUrl, sortOrder }) => ({ id, imageUrl, sortOrder })),
        );
        assert.equal(publicPlace.imageUrl, rows[0]!.imageUrl);
      },
    );
    await t.test(
      "concurrent and stale metadata saves cannot overwrite a dedicated media change",
      async () => {
        const before = await gallery(ownerId);
        const concurrentResponses = await Promise.all([
          call(owner.cookie, `/${ownerId}`, "PATCH", { description: "Concurrent metadata" }),
          call(owner.cookie, `/${ownerId}/images/${before[0]!.id}`, "DELETE"),
        ]);
        assert.deepEqual(
          concurrentResponses.map((response) => response.status),
          [200, 200],
        );
        assert.equal(
          (await db.place.findUniqueOrThrow({ where: { id: ownerId } })).description,
          "Concurrent metadata",
        );
        const after = await gallery(ownerId);
        assert.equal(after.length, before.length - 1);
        assert.deepEqual(
          after.map((image) => image.id),
          before.slice(1).map((image) => image.id),
        );
        const stale = await call(owner.cookie, `/${ownerId}`, "PATCH", {
          description: "Old form",
          imageUrls: before.map((image) => image.imageUrl),
        });
        assert.equal(stale.status, 400);
        assert.deepEqual(await gallery(ownerId), after);
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.outboxEvent.deleteMany({
      where: { topic: PLACE_IMAGE_RECONCILE_TOPIC, aggregateId: { in: places } },
    });
    await db.place.deleteMany({ where: { id: { in: places } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
