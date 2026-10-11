import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, type Prisma } from "@hooma/database";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
function connection() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  return new PrismaClient({ datasourceUrl: url.href });
}
const db = connection();
const firstDb = connection();
const secondDb = connection();
function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Suspend continuations after real PostgreSQL reads; no SQL or repository result is mocked.
function observeReads(client: PrismaClient, onRead: () => Promise<void>) {
  return new Proxy(client, {
    get(target, key) {
      if (key !== "$transaction") {
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (action: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        target.$transaction(
          (tx) =>
            action(
              new Proxy(tx, {
                get(transaction, property) {
                  if (property !== "placeImage") return Reflect.get(transaction, property);
                  return new Proxy(transaction.placeImage, {
                    get(model, method) {
                      const original = Reflect.get(model, method);
                      if (["count", "findFirst", "findMany"].includes(String(method))) {
                        return async (...args: unknown[]) => {
                          const result = await Reflect.apply(original, model, args);
                          await onRead();
                          return result;
                        };
                      }
                      return typeof original === "function" ? original.bind(model) : original;
                    },
                  });
                },
              }),
            ),
          { timeout: 15000 },
        );
    },
  });
}

test("Place gallery mutations serialize across independent PostgreSQL connections", async (t) => {
  const owner = await db.user.create({ data: {} });
  const placeIds: string[] = [];
  const repository = new PrismaPlaceRepository(db);
  async function fixture(count: number) {
    const place = await db.place.create({
      data: {
        slug: randomUUID(),
        name: "Gallery concurrency fixture",
        address: "Disposable fixture",
        suggestedByUserId: owner.id,
        submissionOrigin: "OWNER",
        moderationStatus: "APPROVED",
      },
    });
    placeIds.push(place.id);
    const ids = Array.from({ length: count }, () => randomUUID());
    await db.placeImage.createMany({
      data: ids.map((id, sortOrder) => ({
        id,
        placeId: place.id,
        imageUrl: `https://images.example.test/${id}.webp`,
        sortOrder,
      })),
    });
    return { placeId: place.id, ids };
  }
  async function rows(placeId: string) {
    const gallery = await db.placeImage.findMany({
      where: { placeId },
      orderBy: { sortOrder: "asc" },
    });
    assert.deepEqual(
      gallery.map((row) => row.sortOrder),
      Array.from({ length: gallery.length }, (_, n) => n),
    );
    assert.equal(new Set(gallery.map((row) => row.id)).size, gallery.length);
    const publicPlace = await repository.getApproved(placeId);
    assert.equal(publicPlace?.imageUrl, gallery[0]?.imageUrl ?? null);
    return gallery;
  }
  const add = (repo: PrismaPlaceRepository, placeId: string, id: string, limit = 3) =>
    repo.addImage(placeId, id, `https://images.example.test/${id}.webp`, limit);
  async function pair(
    first: (repo: PrismaPlaceRepository) => Promise<unknown>,
    second: (repo: PrismaPlaceRepository) => Promise<unknown>,
    independent = false,
  ) {
    const arrived = signal();
    const release = signal();
    let held = false;
    let secondRead = false;
    const firstRepo = new PrismaPlaceRepository(
      observeReads(firstDb, async () => {
        if (!held) {
          held = true;
          arrived.resolve();
          await release.promise;
        }
      }),
    );
    const secondRepo = new PrismaPlaceRepository(
      observeReads(secondDb, async () => {
        secondRead = true;
      }),
    );
    const [{ pid }] = await secondDb.$queryRaw<
      Array<{ pid: number }>
    >`SELECT pg_backend_pid() AS pid`;
    const firstOperation = first(firstRepo);
    await arrived.promise;
    const secondOperation = second(secondRepo);
    const settled = Promise.allSettled([firstOperation, secondOperation]);
    let blocked = false;
    try {
      const deadline = Date.now() + 10000;
      while (!secondRead && !blocked) {
        const [state] = await db.$queryRaw<Array<{ blocked: boolean }>>`
          SELECT cardinality(pg_blocking_pids(${pid}::int)) > 0 AS blocked`;
        blocked = state.blocked;
        assert.ok(Date.now() < deadline, "competitor must reach a gallery read or a database lock");
      }
      if (independent) {
        assert.equal(blocked, false, "different Places must not share a gallery lock");
        await secondOperation;
      }
    } finally {
      release.resolve();
    }
    const results = await settled;
    assert.equal(
      blocked,
      !independent,
      `same-Place competitor must wait before reading the gallery: ${JSON.stringify(results.map((result) => (result.status === "rejected" ? { error: result.reason.message, code: result.reason.code } : { status: result.status })))}`,
    );
    return results;
  }
  function success(result: PromiseSettledResult<unknown>) {
    assert.equal(result.status, "fulfilled");
  }
  function rejected(result: PromiseSettledResult<unknown>, message: string) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") assert.equal(result.reason.message, message);
  }
  try {
    await t.test(
      "two owner additions admit only the third image with a domain quota error",
      async () => {
        const { placeId } = await fixture(2);
        const results = await pair(
          (r) => add(r, placeId, randomUUID()),
          (r) => add(r, placeId, randomUUID()),
        );
        success(results[0]);
        rejected(results[1], "PLACE_IMAGE_LIMIT_REACHED");
        assert.equal((await rows(placeId)).length, 3);
      },
    );
    await t.test("concurrent additions both succeed when capacity remains", async () => {
      const { placeId } = await fixture(1);
      const results = await pair(
        (r) => add(r, placeId, randomUUID()),
        (r) => add(r, placeId, randomUUID()),
      );
      results.forEach(success);
      assert.equal((await rows(placeId)).length, 3);
    });
    await t.test("App Admin additions serialize at the six-photo limit", async () => {
      const { placeId } = await fixture(5);
      const results = await pair(
        (r) => add(r, placeId, randomUUID(), 6),
        (r) => add(r, placeId, randomUUID(), 6),
      );
      success(results[0]);
      rejected(results[1], "PLACE_IMAGE_LIMIT_REACHED");
      assert.equal((await rows(placeId)).length, 6);
    });
    for (const deletionFirst of [false, true]) {
      await t.test(`add versus delete, deletion first = ${deletionFirst}`, async () => {
        const { placeId, ids } = await fixture(2);
        const newId = randomUUID();
        const addition = (r: PrismaPlaceRepository) => add(r, placeId, newId);
        const deletion = (r: PrismaPlaceRepository) => r.deleteImage(placeId, ids[0]);
        const results = await pair(
          deletionFirst ? deletion : addition,
          deletionFirst ? addition : deletion,
        );
        results.forEach(success);
        assert.deepEqual(
          (await rows(placeId)).map((row) => row.id),
          [ids[1], newId],
        );
      });
    }
    for (const deletionFirst of [false, true]) {
      await t.test(`reorder versus delete, deletion first = ${deletionFirst}`, async () => {
        const { placeId, ids } = await fixture(3);
        const reorder = (r: PrismaPlaceRepository) => r.reorderImages(placeId, [...ids].reverse());
        const deletion = (r: PrismaPlaceRepository) => r.deleteImage(placeId, ids[1]);
        const results = await pair(
          deletionFirst ? deletion : reorder,
          deletionFirst ? reorder : deletion,
        );
        success(results[0]);
        if (deletionFirst) rejected(results[1], "PLACE_IMAGE_ORDER_INVALID");
        else success(results[1]);
        assert.deepEqual(
          (await rows(placeId)).map((row) => row.id),
          deletionFirst ? [ids[0], ids[2]] : [ids[2], ids[0]],
        );
      });
    }
    for (const additionFirst of [false, true]) {
      await t.test(
        `reorder versus add rejects stale membership, addition first = ${additionFirst}`,
        async () => {
          const { placeId, ids } = await fixture(2);
          const newId = randomUUID();
          const reorder = (r: PrismaPlaceRepository) =>
            r.reorderImages(placeId, [...ids].reverse());
          const addition = (r: PrismaPlaceRepository) => add(r, placeId, newId);
          const results = await pair(
            additionFirst ? addition : reorder,
            additionFirst ? reorder : addition,
          );
          success(results[0]);
          if (additionFirst) rejected(results[1], "PLACE_IMAGE_ORDER_INVALID");
          else success(results[1]);
          assert.deepEqual(
            (await rows(placeId)).map((row) => row.id),
            additionFirst ? [...ids, newId] : [ids[1], ids[0], newId],
          );
        },
      );
    }
    await t.test(
      "prepared publication shares serialization and retains rejected upload intent",
      async () => {
        const { placeId } = await fixture(2);
        const imageId = randomUUID();
        await repository.prepareImageUpload(placeId, imageId);
        const results = await pair(
          (r) => add(r, placeId, randomUUID()),
          (r) => r.addPreparedImage(placeId, imageId, 3),
        );
        success(results[0]);
        rejected(results[1], "PLACE_IMAGE_LIMIT_REACHED");
        assert.equal((await rows(placeId)).length, 3);
        assert.equal(
          (await db.outboxEvent.findUniqueOrThrow({ where: { id: imageId } })).status,
          "PENDING",
        );
      },
    );
    await t.test(
      "prepared publication consumes its intent while competing deletion stays atomic",
      async () => {
        const { placeId, ids } = await fixture(2);
        const imageId = randomUUID();
        await repository.prepareImageUpload(placeId, imageId);
        const results = await pair(
          (r) => r.addPreparedImage(placeId, imageId, 3),
          (r) => r.deleteImage(placeId, ids[0]),
        );
        results.forEach(success);
        assert.deepEqual(
          (await rows(placeId)).map((row) => row.id),
          [ids[1], imageId],
        );
        assert.equal(await db.outboxEvent.findUnique({ where: { id: imageId } }), null);
      },
    );
    await t.test(
      "legacy four-photo gallery retains identities and permits reorder/delete but no addition",
      async () => {
        const { placeId, ids } = await fixture(4);
        const before = await rows(placeId);
        await assert.rejects(
          () => add(repository, placeId, randomUUID()),
          /PLACE_IMAGE_LIMIT_REACHED/,
        );
        assert.deepEqual(await rows(placeId), before);
        await repository.reorderImages(placeId, [...ids].reverse());
        assert.deepEqual(
          (await rows(placeId)).map((row) => row.id),
          [...ids].reverse(),
        );
        await repository.deleteImage(placeId, ids[1]);
        assert.deepEqual(
          (await rows(placeId)).map((row) => row.id),
          [ids[3], ids[2], ids[0]],
        );
        await assert.rejects(
          () => add(repository, placeId, randomUUID()),
          /PLACE_IMAGE_LIMIT_REACHED/,
        );
      },
    );
    await t.test("independent Places mutate without a global gallery lock", async () => {
      const a = await fixture(1);
      const b = await fixture(1);
      const results = await pair(
        (r) => add(r, a.placeId, randomUUID()),
        (r) => add(r, b.placeId, randomUUID()),
        true,
      );
      results.forEach(success);
      assert.equal((await rows(a.placeId)).length, 2);
      assert.equal((await rows(b.placeId)).length, 2);
    });
  } finally {
    await db.outboxEvent.deleteMany({
      where: { aggregateType: "PlaceImage", aggregateId: { in: placeIds } },
    });
    await db.place.deleteMany({ where: { id: { in: placeIds } } });
    await db.user.delete({ where: { id: owner.id } });
    await Promise.all([db.$disconnect(), firstDb.$disconnect(), secondDb.$disconnect()]);
  }
});
