import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { getDatabaseClient, PrismaClient } from "@hooma/database";
import type { ObjectStorage, StoredObject } from "@hooma/storage";
import { PlaceMediaService } from "../apps/api/src/modules/places/application/place-media.service.js";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const topic = "place.image.reconcile-object";
const db = getDatabaseClient();
class ControlledStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly removed: string[] = [];
  failures = 0;
  onPut: (() => Promise<void>) | null = null;
  async put(key: string, body: Uint8Array, contentType: string) {
    this.objects.set(key, { key, body, contentType, sizeBytes: body.byteLength });
    await this.onPut?.();
    return { key, contentType, sizeBytes: body.byteLength };
  }
  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error("missing object");
    return object;
  }
  async remove(key: string) {
    if (this.failures > 0) {
      this.failures--;
      throw new Error("controlled storage failure");
    }
    this.removed.push(key);
    this.objects.delete(key);
  }
  async createReadUrl(key: string) {
    return "https://storage.example.test/" + key;
  }
}

test("Place cleanup is durable, fenced and retryable through PostgreSQL and Worker", async (t) => {
  const storage = new ControlledStorage();
  const repository = new PrismaPlaceRepository(db);
  const owner = await db.user.create({ data: {} });
  const place = await db.place.create({
    data: {
      slug: "cleanup-" + randomUUID(),
      name: "Cleanup " + randomUUID(),
      address: "Disposable integration fixture",
      suggestedByUserId: owner.id,
      submissionOrigin: "OWNER",
      moderationStatus: "PENDING",
    },
  });
  const media = new PlaceMediaService(
    repository,
    { isPlatformAdmin: async () => false },
    { resolve: async (url: string) => url },
    storage,
    { process: async () => ({ body: new Uint8Array([1]), contentType: "image/webp" }) },
  );
  const key = (id: string) => "place-images/" + place.id + "/" + id;
  const url = (id: string) => "/api/public/v1/places/" + place.id + "/images/" + id + "/content";
  const upload = () =>
    media.addUpload(owner.id, place.id, {
      body: new Uint8Array([1]),
      contentType: "image/png",
    });
  const due = () =>
    db.outboxEvent.updateMany({
      where: { topic, aggregateId: place.id, status: "PENDING" },
      data: { availableAt: new Date(0) },
    });
  try {
    await t.test(
      "managed deletion commits a cleanup event even when storage is unavailable",
      async () => {
        const id = randomUUID();
        await repository.addImage(place.id, id, url(id), 3);
        await storage.put(key(id), new Uint8Array([1]), "image/webp");
        storage.failures = 1;
        await media.delete(owner.id, place.id, id);
        assert.equal(await repository.getImage(place.id, id), null);
        const intent = await db.outboxEvent.findFirst({ where: { topic, aggregateId: place.id } });
        assert.ok(intent, "gallery deletion must leave durable cleanup ownership");
        assert.deepEqual(intent.payload, { placeId: place.id, imageId: id, objectKey: key(id) });
        assert.equal(intent.status, "PENDING");
        assert.equal(storage.objects.has(key(id)), true);
        storage.failures = 0;
      },
    );
    const { createPlaceImageCleanupHandler } =
      await import("../apps/worker/src/places/place-image-cleanup.js");
    const handler = createPlaceImageCleanupHandler(db, storage);
    const runner = () =>
      new OutboxRunner(new OutboxRepository(db), new Map([[topic, handler]]), {
        random: () => 0.5,
      });
    await t.test(
      "a new Worker instance retries a transient failure and removes the intended object",
      async () => {
        storage.failures = 1;
        await due();
        assert.equal((await runner().runOnce()).retried, 1);
        const event = await db.outboxEvent.findFirstOrThrow({
          where: { topic, aggregateId: place.id, status: "PENDING" },
        });
        assert.equal(event.attempts, 1);
        assert.match(event.lastError!, /controlled storage failure/);
        await due();
        assert.equal((await runner().runOnce()).delivered, 1);
        const saved = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
        assert.equal(saved.status, "DELIVERED");
        assert.equal(storage.objects.size, 0);
        await handler({ id: event.id, topic, payload: event.payload });
        assert.equal(storage.objects.size, 0);
      },
    );
    await t.test("external URL removal never schedules physical cleanup", async () => {
      const image = await media.addExternal(owner.id, place.id, {
        url: "https://cdn.example.test/photo.webp",
      });
      const before = await db.outboxEvent.count({ where: { topic, aggregateId: place.id } });
      const removed = storage.removed.length;
      await media.delete(owner.id, place.id, image.id);
      assert.equal(await db.outboxEvent.count({ where: { topic, aggregateId: place.id } }), before);
      assert.equal(storage.removed.length, removed);
    });
    await t.test(
      "normal upload consumes its intent and referenced objects are protected",
      async () => {
        const image = await upload();
        assert.equal(await db.outboxEvent.findUnique({ where: { id: image.id } }), null);
        await db.place.update({ where: { id: place.id }, data: { moderationStatus: "APPROVED" } });
        assert.equal(
          await media.deliveryUrlPublic(place.id, image.id),
          "https://storage.example.test/" + key(image.id),
        );
        const removed = storage.removed.length;
        await handler({
          id: image.id,
          topic,
          payload: { placeId: place.id, imageId: image.id, objectKey: key(image.id) },
        });
        assert.equal(storage.removed.length, removed);
        assert.equal(storage.objects.has(key(image.id)), true);
        // Protect a canonical URL reference even if its row has another identity.
        const alias = randomUUID();
        await repository.addImage(place.id, alias, url(image.id), 3);
        await db.placeImage.delete({ where: { id: image.id } });
        await handler({
          id: image.id,
          topic,
          payload: { placeId: place.id, imageId: image.id, objectKey: key(image.id) },
        });
        assert.equal(storage.removed.length, removed);
        await db.placeImage.delete({ where: { id: alias } });
        await handler({
          id: image.id,
          topic,
          payload: { placeId: place.id, imageId: image.id, objectKey: key(image.id) },
        });
        assert.equal(storage.objects.has(key(image.id)), false);
        await db.place.update({ where: { id: place.id }, data: { moderationStatus: "PENDING" } });
      },
    );
    await t.test("lost commit response never triggers removal of a published image", async () => {
      const original = repository.addPreparedImage.bind(repository);
      repository.addPreparedImage = async (placeId, imageId, limit) => {
        await original(placeId, imageId, limit);
        throw new Error("attachment commit response lost");
      };
      try {
        await assert.rejects(upload, /commit response lost/);
        const image = await db.placeImage.findFirstOrThrow({ where: { placeId: place.id } });
        assert.equal(storage.objects.has(key(image.id)), true);
        assert.equal(await db.outboxEvent.findUnique({ where: { id: image.id } }), null);
        await media.delete(owner.id, place.id, image.id);
        await runner().runOnce();
        assert.equal(storage.objects.has(key(image.id)), false);
      } finally {
        repository.addPreparedImage = original;
      }
    });
    await t.test(
      "attachment failure and failed immediate cleanup retain an intent for later recovery",
      async () => {
        for (let n = 0; n < 3; n++)
          await media.addExternal(owner.id, place.id, {
            url: "https://cdn.example.test/" + n + ".webp",
          });
        storage.failures = 1;
        await assert.rejects(
          upload,
          (error: unknown) => (error as { code?: string }).code === "PLACE_IMAGE_LIMIT_REACHED",
        );
        const pending = await db.outboxEvent.findFirstOrThrow({
          where: { topic, aggregateId: place.id, status: "PENDING" },
        });
        assert.equal(storage.objects.size, 1);
        assert.equal(await db.placeImage.count({ where: { placeId: place.id } }), 3);
        await due();
        assert.equal((await runner().runOnce()).delivered, 1);
        assert.equal(storage.objects.size, 0);
        assert.equal(
          (await db.outboxEvent.findUniqueOrThrow({ where: { id: pending.id } })).status,
          "DELIVERED",
        );
        await db.placeImage.deleteMany({ where: { placeId: place.id } });
      },
    );
    await t.test(
      "cleanup is durable before PUT and Worker claim fences late attachment",
      async () => {
        storage.onPut = async () => {
          const intent = await db.outboxEvent.findFirstOrThrow({
            where: { topic, aggregateId: place.id, status: "PENDING" },
          });
          assert.equal(
            (intent.payload as { objectKey: string }).objectKey,
            [...storage.objects.keys()][0],
          );
          assert.equal((await runner().runOnce(new Date(Date.now() + 7200000))).delivered, 1);
        };
        await assert.rejects(upload, /expired/i);
        storage.onPut = null;
        assert.equal(await db.placeImage.count({ where: { placeId: place.id } }), 0);
        assert.equal(storage.objects.size, 0);
      },
    );
    await t.test(
      "failed Worker cleanup also fences a late upload after retry release",
      async () => {
        storage.onPut = async () => {
          storage.failures = 1;
          assert.equal((await runner().runOnce(new Date(Date.now() + 7200000))).retried, 1);
        };
        await assert.rejects(upload, /expired/i);
        storage.onPut = null;
        assert.equal(await db.placeImage.count({ where: { placeId: place.id } }), 0);
        await due();
        await runner().runOnce();
        assert.equal(storage.objects.size, 0);
      },
    );
    await t.test("ambiguous PUT failure retains cleanup for bytes already stored", async () => {
      storage.onPut = async () => {
        throw new Error("PUT response lost");
      };
      await assert.rejects(upload, /PUT response lost/);
      storage.onPut = null;
      assert.equal(storage.objects.size, 1);
      assert.equal(await db.placeImage.count({ where: { placeId: place.id } }), 0);
      await due();
      assert.equal((await runner().runOnce()).delivered, 1);
      assert.equal(storage.objects.size, 0);
    });
    await t.test(
      "an interrupted API process leaves its stored object recoverable by a restarted Worker",
      async () => {
        const server = createServer((request, response) => {
          const objectKey = decodeURIComponent(request.url!.slice(1));
          request.resume();
          request.on("end", () => {
            storage.objects.set(objectKey, {
              key: objectKey,
              body: new Uint8Array([1]),
              contentType: "image/webp",
              sizeBytes: 1,
            });
            response.end("ok");
          });
        }).listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const childSource = `
        import { PrismaClient } from "@hooma/database";
        import { PrismaPlaceRepository } from "./apps/api/src/modules/places/infrastructure/prisma-place.repository.ts";
        import { PlaceMediaService } from "./apps/api/src/modules/places/application/place-media.service.ts";
        const db = new PrismaClient(); const repo = new PrismaPlaceRepository(db);
        repo.addPreparedImage = async (_placeId, imageId) => {
          console.log("READY " + imageId);
          await new Promise(() => {});
        };
        const storage = {
          async put(key, body, contentType) {
            const response = await fetch(process.env.E1B_STORAGE_ORIGIN + "/" + encodeURIComponent(key), { method: "PUT", body });
            if (!response.ok) throw new Error("storage fixture failed");
            return { key, contentType, sizeBytes: body.length };
          }, async get() { throw new Error("unused"); }, async remove() { throw new Error("interrupted path must not remove"); }
        };
        const service = new PlaceMediaService(repo, { isPlatformAdmin: async () => true }, { resolve: async v => v }, storage,
          { process: async () => ({ body: new Uint8Array([1]), contentType: "image/webp" }) });
        await service.addUpload(process.env.E1B_USER_ID, process.env.E1B_PLACE_ID, { contentType: "image/png", body: new Uint8Array([1]) });
      `;
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", childSource],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              E1B_PLACE_ID: place.id,
              E1B_USER_ID: owner.id,
              E1B_STORAGE_ORIGIN: "http://127.0.0.1:" + address.port,
            },
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          },
        );
        let errors = "";
        child.stderr!.on("data", (chunk) => {
          errors += chunk;
        });
        let timer: ReturnType<typeof setTimeout>;
        const ready = new Promise<string>((resolve, reject) => {
          let output = "";
          timer = setTimeout(
            () => reject(new Error("API interruption fixture timeout: " + errors)),
            15000,
          );
          child.stdout!.on("data", (chunk) => {
            output += chunk;
            const match = output.match(/READY ([a-zA-Z0-9-]+)/);
            if (match) resolve(match[1]!);
          });
          child.once("exit", (code) =>
            reject(new Error("API fixture exited before interruption: " + code + " " + errors)),
          );
          child.once("error", reject);
        });
        try {
          const id = await ready;
          clearTimeout(timer!);
          const exited = once(child, "exit");
          child.kill();
          await exited;
          assert.equal(await repository.getImage(place.id, id), null);
          assert.equal(storage.objects.has(key(id)), true);
          assert.equal(
            (await db.outboxEvent.findUniqueOrThrow({ where: { id } })).status,
            "PENDING",
          );
          await due();
          const workerDb = new PrismaClient();
          try {
            const restarted = new OutboxRunner(
              new OutboxRepository(workerDb),
              new Map([[topic, createPlaceImageCleanupHandler(workerDb, storage)]]),
            );
            assert.equal((await restarted.runOnce()).delivered, 1);
            assert.equal(storage.objects.has(key(id)), false);
          } finally {
            await workerDb.$disconnect();
          }
        } finally {
          clearTimeout(timer!);
          if (child.exitCode === null && child.signalCode === null) child.kill();
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
        }
      },
    );
    await t.test(
      "gallery deletion rolls back if its cleanup intent cannot be persisted",
      async () => {
        const id = randomUUID();
        await repository.addImage(place.id, id, url(id), 3);
        await repository.prepareImageUpload(place.id, id);
        await assert.rejects(() => media.delete(owner.id, place.id, id));
        assert.ok(await repository.getImage(place.id, id));
        await db.outboxEvent.delete({ where: { id } });
        await media.delete(owner.id, place.id, id);
        await due();
        await runner().runOnce();
      },
    );
    await t.test(
      "committed upload intent survives client disconnect and stale Worker lease",
      async () => {
        const id = randomUUID();
        const apiDb = new PrismaClient();
        await new PrismaPlaceRepository(apiDb).prepareImageUpload(place.id, id);
        await storage.put(key(id), new Uint8Array([1]), "image/webp");
        await apiDb.$disconnect();
        await db.outboxEvent.update({
          where: { id },
          data: {
            status: "PROCESSING",
            claimedAt: new Date(Date.now() - 300000),
          },
        });
        const workerDb = new PrismaClient();
        try {
          const restarted = new OutboxRunner(
            new OutboxRepository(workerDb),
            new Map([[topic, createPlaceImageCleanupHandler(workerDb, storage)]]),
          );
          assert.equal((await restarted.runOnce()).delivered, 1);
          assert.equal(storage.objects.has(key(id)), false);
        } finally {
          await workerDb.$disconnect();
        }
      },
    );
    await t.test(
      "terminal storage failure keeps its payload and error for operator recovery",
      async () => {
        const id = randomUUID();
        await repository.addImage(place.id, id, url(id), 3);
        await storage.put(key(id), new Uint8Array([1]), "image/webp");
        await media.delete(owner.id, place.id, id);
        await db.outboxEvent.update({ where: { id }, data: { attempts: 7 } });
        storage.failures = 1;
        assert.equal((await runner().runOnce()).failed, 1);
        const failed = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
        assert.equal(failed.status, "FAILED");
        assert.equal(failed.attempts, 8);
        assert.match(failed.lastError!, /controlled storage failure/);
        assert.deepEqual(failed.payload, { placeId: place.id, imageId: id, objectKey: key(id) });
        assert.equal(storage.objects.has(key(id)), true);
      },
    );
    await t.test(
      "cleanup rejects foreign keys, identity mismatch and malformed payload",
      async () => {
        const id = randomUUID();
        const before = storage.removed.length;
        for (const payload of [
          { placeId: place.id, imageId: id, objectKey: "request-images/" + place.id + "/" + id },
          { placeId: place.id, imageId: id, objectKey: key(id) + "/other" },
          { placeId: place.id, imageId: randomUUID(), objectKey: key(id) },
          { placeId: "../foreign", imageId: id, objectKey: "place-images/../foreign/" + id },
          {},
        ])
          await assert.rejects(() => handler({ id, topic, payload }));
        assert.equal(storage.removed.length, before);
      },
    );
  } finally {
    await db.outboxEvent.deleteMany({ where: { topic, aggregateId: place.id } });
    await db.place.delete({ where: { id: place.id } });
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
