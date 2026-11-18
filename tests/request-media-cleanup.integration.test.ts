import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { REQUEST_IMAGE_RECONCILE_TOPIC } from "@hooma/contracts/requests";
import { getDatabaseClient } from "@hooma/database";
import { buildMediaObjectKey } from "@hooma/media-processing";
import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { PrismaRequestImageRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request-image.repository.js";
import { createRequestImageCleanupHandler } from "../apps/worker/src/requests/request-image-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

const db = getDatabaseClient();
const storageScope = "development" as const;

class ControlledStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly removed: string[] = [];

  async put(key: string, body: Uint8Array, contentType: string) {
    const object = { key, body, contentType, sizeBytes: body.byteLength };
    this.objects.set(key, object);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error("missing object");
    return object;
  }

  async remove(key: string) {
    this.removed.push(key);
    this.objects.delete(key);
  }
}

test("Requests media persistence and cleanup run through PostgreSQL and the real Outbox Worker", async () => {
  const storage = new ControlledStorage();
  const images = new PrismaRequestImageRepository(db);
  const owner = await db.user.create({ data: {} });
  let requestId: string | null = null;

  try {
    const request = await db.helpRequest.create({
      data: {
        createdByUserId: owner.id,
        audienceScope: "PUBLIC",
        category: "ITEM",
        itemKind: "OTHER",
        title: `Media lifecycle ${randomUUID()}`,
        description: "Disposable integration fixture for Requests-owned media.",
      },
    });
    requestId = request.id;

    const handler = createRequestImageCleanupHandler(db, storage, storageScope);
    const runner = new OutboxRunner(
      new OutboxRepository(db),
      new Map([[REQUEST_IMAGE_RECONCILE_TOPIC, handler]]),
    );
    const keyFor = (mediaId: string) =>
      buildMediaObjectKey({
        scope: storageScope,
        namespace: "REQUEST_PHOTO",
        ownerId: request.id,
        mediaId,
        variant: "master",
      });
    const upload = async (mediaId: string, bytes: Uint8Array) => {
      const objectKey = keyFor(mediaId);
      await images.prepareUpload(mediaId, request.id, objectKey);
      await storage.put(objectKey, bytes, "image/webp");
      return images.replacePreparedUpload({
        mediaId,
        requestId: request.id,
        objectKey,
        contentType: "image/webp",
        sizeBytes: bytes.byteLength,
      });
    };
    const scheduleCleanup = async (objectKey: string) => {
      const id = randomUUID();
      await db.outboxEvent.create({
        data: {
          id,
          topic: REQUEST_IMAGE_RECONCILE_TOPIC,
          aggregateType: "HelpRequestImage",
          aggregateId: request.id,
          payload: { requestId: request.id, objectKey },
          availableAt: new Date(0),
        },
      });
      return id;
    };

    const firstMediaId = randomUUID();
    const firstKey = keyFor(firstMediaId);
    const beforeIntent = new Date();
    await images.prepareUpload(firstMediaId, request.id, firstKey);
    const intent = await db.outboxEvent.findUniqueOrThrow({ where: { id: firstMediaId } });
    assert.equal(intent.topic, REQUEST_IMAGE_RECONCILE_TOPIC);
    assert.equal(intent.status, "PENDING");
    assert.equal(intent.aggregateType, "HelpRequestImage");
    assert.equal(intent.aggregateId, request.id);
    assert.deepEqual(intent.payload, { requestId: request.id, objectKey: firstKey });
    assert.ok(intent.availableAt > beforeIntent, "upload reconciliation must be delayed");

    const firstBytes = new Uint8Array([1, 2, 3, 4]);
    await storage.put(firstKey, firstBytes, "image/webp");
    await images.replacePreparedUpload({
      mediaId: firstMediaId,
      requestId: request.id,
      objectKey: firstKey,
      contentType: "image/webp",
      sizeBytes: firstBytes.byteLength,
    });
    assert.equal(await db.outboxEvent.findUnique({ where: { id: firstMediaId } }), null);
    const firstImage = await db.helpRequestImage.findUniqueOrThrow({
      where: { requestId: request.id },
    });
    assert.equal(firstImage.objectKey, firstKey);
    assert.equal(firstImage.contentType, "image/webp");
    assert.equal(firstImage.sizeBytes, firstBytes.byteLength);
    assert.equal(firstImage.source, "UPLOAD");

    const secondMediaId = randomUUID();
    const secondBytes = new Uint8Array([5, 6, 7, 8, 9]);
    await upload(secondMediaId, secondBytes);
    const currentImage = await db.helpRequestImage.findUniqueOrThrow({
      where: { requestId: request.id },
    });
    assert.equal(currentImage.objectKey, keyFor(secondMediaId));
    assert.equal(currentImage.contentType, "image/webp");
    assert.equal(currentImage.sizeBytes, secondBytes.byteLength);

    const replacementEvents = await db.outboxEvent.findMany({
      where: {
        topic: REQUEST_IMAGE_RECONCILE_TOPIC,
        aggregateId: request.id,
        status: "PENDING",
      },
    });
    assert.equal(replacementEvents.length, 1);
    assert.deepEqual(replacementEvents[0]?.payload, {
      requestId: request.id,
      objectKey: firstKey,
    });
    const replacementEventId = replacementEvents[0]!.id;
    const replacementResult = await runner.runOnce();
    assert.equal(replacementResult.delivered, 1);
    assert.equal(storage.objects.has(firstKey), false);
    assert.equal(storage.objects.has(keyFor(secondMediaId)), true);
    const replacementEvent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: replacementEventId },
    });
    assert.equal(replacementEvent.status, "DELIVERED");
    assert.ok(replacementEvent.deliveredAt);

    const currentKey = keyFor(secondMediaId);
    const protectedEventId = await scheduleCleanup(currentKey);
    const protectedResult = await runner.runOnce();
    assert.equal(protectedResult.delivered, 1);
    assert.equal(storage.objects.has(currentKey), true);
    assert.deepEqual(
      await db.helpRequestImage.findUniqueOrThrow({ where: { requestId: request.id } }),
      currentImage,
    );
    const protectedEvent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: protectedEventId },
    });
    assert.equal(protectedEvent.status, "DELIVERED");
    assert.ok(protectedEvent.deliveredAt);

    const deleted = await images.deleteForRequest(request.id);
    assert.equal(deleted?.objectKey, currentKey);
    assert.equal(await db.helpRequestImage.findUnique({ where: { requestId: request.id } }), null);
    const deletionEvents = await db.outboxEvent.findMany({
      where: {
        topic: REQUEST_IMAGE_RECONCILE_TOPIC,
        aggregateId: request.id,
        status: "PENDING",
      },
    });
    assert.equal(deletionEvents.length, 1);
    assert.deepEqual(deletionEvents[0]?.payload, {
      requestId: request.id,
      objectKey: currentKey,
    });
    const deletionEventId = deletionEvents[0]!.id;
    assert.equal((await runner.runOnce()).delivered, 1);
    assert.equal(storage.objects.has(currentKey), false);
    const deletionEvent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: deletionEventId },
    });
    assert.equal(deletionEvent.status, "DELIVERED");
    assert.ok(deletionEvent.deliveredAt);

    const failedMediaId = randomUUID();
    const failedKey = keyFor(failedMediaId);
    await images.prepareUpload(failedMediaId, request.id, failedKey);
    await storage.put(failedKey, new Uint8Array([10, 11]), "image/webp");
    assert.equal(await db.helpRequestImage.findUnique({ where: { requestId: request.id } }), null);
    const failedIntent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: failedMediaId },
    });
    assert.equal(failedIntent.status, "PENDING");
    await db.outboxEvent.update({
      where: { id: failedMediaId },
      data: { availableAt: new Date(0) },
    });
    const failedUploadResult = await runner.runOnce();
    assert.equal(failedUploadResult.delivered, 1);
    assert.equal(storage.objects.has(failedKey), false);
    const recoveredIntent = await db.outboxEvent.findUniqueOrThrow({
      where: { id: failedMediaId },
    });
    assert.equal(recoveredIntent.status, "DELIVERED");
    assert.ok(recoveredIntent.deliveredAt);

    const legacyMediaId = randomUUID();
    const legacyKey = `request-images/${request.id}/${legacyMediaId}`;
    await storage.put(legacyKey, new Uint8Array([12]), "image/webp");
    const legacyEventId = await scheduleCleanup(legacyKey);
    assert.equal((await runner.runOnce()).delivered, 1);
    assert.equal(storage.objects.has(legacyKey), false);
    assert.equal(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: legacyEventId } })).status,
      "DELIVERED",
    );

    const invalidKeys = [
      `request-images/${request.id}/../outside`,
      `request-images/${randomUUID()}/${randomUUID()}`,
    ];
    for (const objectKey of invalidKeys) {
      await storage.put(objectKey, new Uint8Array([13]), "image/webp");
      const eventId = await scheduleCleanup(objectKey);
      const result = await runner.runOnce();
      assert.equal(result.retried, 1);
      assert.equal(storage.objects.has(objectKey), true);
      const event = await db.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
      assert.equal(event.status, "PENDING");
      assert.equal(event.attempts, 1);
      assert.match(event.lastError ?? "", /ownership boundary/);
      await db.outboxEvent.update({
        where: { id: eventId },
        data: { availableAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
    }
  } finally {
    if (requestId) {
      const events = await db.outboxEvent.findMany({
        where: { topic: REQUEST_IMAGE_RECONCILE_TOPIC, aggregateId: requestId },
        select: { id: true },
      });
      if (events.length) {
        await db.outboxEvent.deleteMany({ where: { id: { in: events.map(({ id }) => id) } } });
      }
      await db.helpRequestImage.deleteMany({ where: { requestId } });
      await db.helpRequest.deleteMany({ where: { id: requestId } });
    }
    await db.user.deleteMany({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
