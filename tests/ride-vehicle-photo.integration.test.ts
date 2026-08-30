import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage, StoredObject, StoredObjectDescriptor } from "@hooma/storage";
import { createApp } from "../apps/api/src/bootstrap/app.js";
import { createContainer } from "../apps/api/src/bootstrap/container.js";
import {
  createRideVehiclePhotoCleanupHandler,
  RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
} from "../apps/worker/src/rides/ride-vehicle-photo-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Ride vehicle-photo tests");

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
  readonly removedKeys: string[] = [];
  readonly failRemoveKeys = new Set<string>();
  failPut = false;

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor> {
    if (this.failPut) throw new Error("expected put failure");
    const stored = {
      key,
      body: new Uint8Array(body),
      contentType,
      sizeBytes: body.byteLength,
    };
    this.objects.set(key, stored);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<StoredObject> {
    const object = this.objects.get(key);
    if (!object) throw new Error("object not found");
    return object;
  }

  async remove(key: string): Promise<void> {
    if (this.failRemoveKeys.has(key)) throw new Error("expected remove failure");
    this.removedKeys.push(key);
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
  return { cookie, userId: credential.userId };
}

function jsonHeaders(cookie: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": "application/json" };
}

function imageHeaders(cookie: string, contentType: string) {
  return { cookie, origin: config.WEB_ORIGIN, "content-type": contentType };
}

function futureDate(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

async function createRideOffer(base: string, cookie: string): Promise<string> {
  const response = await fetch(`${base}/api/v1/rides/offers`, {
    method: "POST",
    headers: jsonHeaders(cookie),
    body: JSON.stringify({
      destination: { type: "CUSTOM", customDestinationLabel: "Stade Olympique de Rades" },
      originAreaLabel: "Lac 2",
      departureAt: futureDate(90),
      totalSeats: 2,
      vehicleMake: "Dacia",
      vehicleModel: "Sandero",
      vehicleColor: "White",
    }),
  });
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
}

test("Ride vehicle-photo upload, delivery, replacement and cleanup stay Ride-owned", async () => {
  const storage = new MemoryObjectStorage();
  const container = createContainer(config, { objectStorage: storage });
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const createdUserIds: string[] = [];
  let rideOfferId: string | null = null;

  try {
    const suffix = Date.now().toString(36);
    const driver = await register(base, `ride_photo_driver_${suffix}`);
    const outsider = await register(base, `ride_photo_outsider_${suffix}`);
    createdUserIds.push(driver.userId, outsider.userId);
    rideOfferId = await createRideOffer(base, driver.cookie);

    const missingPhoto = await fetch(`${base}/api/public/v1/rides/offers/${rideOfferId}/photo`);
    assert.equal(missingPhoto.status, 404);

    const unauthenticatedUpload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: { origin: config.WEB_ORIGIN, "content-type": "image/png" },
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(unauthenticatedUpload.status, 401);

    const nonOwnerUpload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(outsider.cookie, "image/png"),
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(nonOwnerUpload.status, 403);
    assert.equal(storage.objects.size, 0);

    const invalidTypeUpload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "text/plain"),
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(invalidTypeUpload.status, 415);
    assert.equal(storage.objects.size, 0);

    const tooLargeUpload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "image/png"),
      body: new Uint8Array(5 * 1024 * 1024 + 1),
    });
    assert.equal(tooLargeUpload.status, 413);
    assert.equal(storage.objects.size, 0);

    storage.failPut = true;
    const failedUpload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "image/png"),
      body: Uint8Array.of(9, 9, 9),
    });
    assert.equal(failedUpload.status, 503);
    assert.equal(await db.rideOfferVehiclePhoto.count({ where: { rideOfferId } }), 0);
    assert.ok(await db.rideOffer.findUnique({ where: { id: rideOfferId } }));
    storage.failPut = false;

    const upload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "image/png"),
      body: Uint8Array.of(1, 2, 3, 4),
    });
    assert.equal(upload.status, 200);
    const uploaded = (await upload.json()) as Record<string, unknown>;
    assert.equal(uploaded.rideOfferId, rideOfferId);
    assert.equal(uploaded.contentType, "image/png");
    assert.equal(uploaded.sizeBytes, 4);
    assert.equal("objectKey" in uploaded, false);

    const firstRow = await db.rideOfferVehiclePhoto.findUniqueOrThrow({ where: { rideOfferId } });
    assert.match(firstRow.objectKey, new RegExp(`^ride-offer-vehicles/${rideOfferId}/`));
    assert.equal(firstRow.contentType, "image/png");
    assert.equal(firstRow.sizeBytes, 4);
    assert.ok(storage.objects.has(firstRow.objectKey));

    const publicOffer = await fetch(`${base}/api/public/v1/rides/offers/${rideOfferId}`);
    assert.equal(publicOffer.status, 200);
    const publicOfferBody = (await publicOffer.json()) as Record<string, unknown>;
    assert.equal(publicOfferBody.hasVehiclePhoto, true);
    assert.equal("objectKey" in publicOfferBody, false);

    const publicPhoto = await fetch(`${base}/api/public/v1/rides/offers/${rideOfferId}/photo`);
    assert.equal(publicPhoto.status, 200);
    assert.equal(publicPhoto.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await publicPhoto.arrayBuffer()), Uint8Array.of(1, 2, 3, 4));

    storage.failRemoveKeys.add(firstRow.objectKey);
    const replace = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "image/webp"),
      body: Uint8Array.of(5, 6),
    });
    assert.equal(replace.status, 200);
    const secondRow = await db.rideOfferVehiclePhoto.findUniqueOrThrow({ where: { rideOfferId } });
    assert.notEqual(secondRow.objectKey, firstRow.objectKey);
    assert.equal(secondRow.contentType, "image/webp");
    assert.ok(storage.objects.has(secondRow.objectKey));
    assert.ok(storage.objects.has(firstRow.objectKey));

    const cleanupEvent = await db.outboxEvent.findFirstOrThrow({
      where: {
        topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
        aggregateId: firstRow.objectKey,
        status: "PENDING",
      },
    });
    assert.equal(
      (cleanupEvent.payload as { readonly objectKey?: unknown }).objectKey,
      firstRow.objectKey,
    );

    storage.failRemoveKeys.delete(firstRow.objectKey);
    const runner = new OutboxRunner(
      new OutboxRepository(db),
      new Map([
        [RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC, createRideVehiclePhotoCleanupHandler(storage)],
      ]),
    );
    assert.deepEqual(await runner.runOnce(), {
      claimed: 1,
      delivered: 1,
      retried: 0,
      failed: 0,
    });
    assert.equal(storage.objects.has(firstRow.objectKey), false);

    const deletePhoto = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "DELETE",
      headers: jsonHeaders(driver.cookie),
    });
    assert.equal(deletePhoto.status, 204);
    assert.equal(await db.rideOfferVehiclePhoto.count({ where: { rideOfferId } }), 0);
    assert.equal(storage.objects.has(secondRow.objectKey), false);

    const publicOfferAfterDelete = await fetch(`${base}/api/public/v1/rides/offers/${rideOfferId}`);
    assert.equal(publicOfferAfterDelete.status, 200);
    assert.equal(
      ((await publicOfferAfterDelete.json()) as Record<string, unknown>).hasVehiclePhoto,
      false,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    await db.outboxEvent.deleteMany({ where: { topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC } });
    if (rideOfferId) {
      await db.rideOfferVehiclePhoto.deleteMany({ where: { rideOfferId } });
      await db.rideMeetingPoint.deleteMany({
        where: { participation: { rideOfferId } },
      });
      await db.rideParticipation.deleteMany({ where: { rideOfferId } });
      await db.rideOfferWaypoint.deleteMany({ where: { rideOfferId } });
      await db.rideOffer.deleteMany({ where: { id: rideOfferId } });
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

test("Ride vehicle-photo upload fails honestly when object storage is not configured", async () => {
  const container = createContainer(config, { objectStorage: null });
  const app = createApp(config, container);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const createdUserIds: string[] = [];
  let rideOfferId: string | null = null;

  try {
    const suffix = Date.now().toString(36);
    const driver = await register(base, `ride_photo_no_storage_${suffix}`);
    createdUserIds.push(driver.userId);
    rideOfferId = await createRideOffer(base, driver.cookie);

    const upload = await fetch(`${base}/api/v1/rides/offers/${rideOfferId}/photo`, {
      method: "PUT",
      headers: imageHeaders(driver.cookie, "image/png"),
      body: Uint8Array.of(1, 2, 3),
    });
    assert.equal(upload.status, 503);
    assert.equal(
      ((await upload.json()) as { error: { code: string } }).error.code,
      "RIDE_VEHICLE_PHOTO_STORAGE_NOT_CONFIGURED",
    );
    assert.equal(await db.rideOfferVehiclePhoto.count({ where: { rideOfferId } }), 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    container.redis.close();
    if (rideOfferId) {
      await db.rideOfferVehiclePhoto.deleteMany({ where: { rideOfferId } });
      await db.rideOfferWaypoint.deleteMany({ where: { rideOfferId } });
      await db.rideOffer.deleteMany({ where: { id: rideOfferId } });
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
