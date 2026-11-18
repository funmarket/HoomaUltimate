import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaObjectKey } from "@hooma/media-processing";
import { REQUEST_IMAGE_RECONCILE_TOPIC } from "@hooma/contracts/requests";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { createRequestImageCleanupHandler } from "../apps/worker/src/requests/request-image-cleanup.js";

function cleanupFixture(referenced: boolean) {
  const queries: unknown[] = [];
  const removes: string[] = [];
  const database = {
    helpRequestImage: {
      findFirst: async (query: unknown) => {
        queries.push(query);
        return referenced ? { id: "image-1" } : null;
      },
    },
  };
  const storage = {
    remove: async (objectKey: string) => {
      removes.push(objectKey);
    },
  };
  const handler = createRequestImageCleanupHandler(
    database as unknown as PrismaClient,
    storage as unknown as ObjectStorage,
    "staging",
  );
  return { handler, queries, removes };
}

function event(objectKey: string) {
  return {
    id: "reconcile-1",
    topic: REQUEST_IMAGE_RECONCILE_TOPIC,
    payload: { requestId: "request-1", objectKey },
  };
}

test("Request cleanup removes an unreferenced typed key in its configured scope", async () => {
  const fixture = cleanupFixture(false);
  const objectKey = buildMediaObjectKey({
    scope: "staging",
    namespace: "REQUEST_PHOTO",
    ownerId: "request-1",
    mediaId: "media-1",
    variant: "master",
  });

  await fixture.handler(event(objectKey));

  assert.deepEqual(fixture.removes, [objectKey]);
  assert.deepEqual(fixture.queries, [{ where: { objectKey }, select: { id: true } }]);
});

test("Request cleanup retains a typed object while canonical metadata still references it", async () => {
  const fixture = cleanupFixture(true);
  const objectKey = buildMediaObjectKey({
    scope: "staging",
    namespace: "REQUEST_PHOTO",
    ownerId: "request-1",
    mediaId: "media-1",
    variant: "master",
  });

  await fixture.handler(event(objectKey));

  assert.deepEqual(fixture.removes, []);
});

test("Request cleanup rejects typed keys outside the configured scope and keeps legacy keys", async () => {
  const fixture = cleanupFixture(false);
  const wrongScopeKey = buildMediaObjectKey({
    scope: "production",
    namespace: "REQUEST_PHOTO",
    ownerId: "request-1",
    mediaId: "media-1",
    variant: "master",
  });

  await assert.rejects(() => fixture.handler(event(wrongScopeKey)));
  assert.deepEqual(fixture.removes, []);

  const legacyKey = "request-images/request-1/legacy-media";
  await fixture.handler(event(legacyKey));
  assert.deepEqual(fixture.removes, [legacyKey]);
});
